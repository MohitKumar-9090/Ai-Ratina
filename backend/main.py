"""
RetinaAI Backend — FastAPI server for diabetic retinopathy screening.

Run with:
    uvicorn main:app --reload --port 8001
"""

import os
import traceback

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

import database
from services import model_service
from services.gradcam_service import generate_gradcam_images
from utils.image_utils import load_image, preprocess_image, validate_file

# ──────────────────────────────────────────────
# Environment
# ──────────────────────────────────────────────
load_dotenv()

DEFAULT_CORS_ORIGINS = [
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

env_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
CORS_ORIGINS = list(set(DEFAULT_CORS_ORIGINS + env_origins))

# ──────────────────────────────────────────────
# App
# ──────────────────────────────────────────────
app = FastAPI(
    title="RetinaAI API",
    description="Explainable AI-based Diabetic Retinopathy Screening",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve generated Grad-CAM images
GENERATED_DIR = os.path.join(os.path.dirname(__file__), "generated")
os.makedirs(GENERATED_DIR, exist_ok=True)
app.mount("/generated", StaticFiles(directory=GENERATED_DIR), name="generated")


# ──────────────────────────────────────────────
# Startup
# ──────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    """Load model and initialize SQLite DB when server starts."""
    try:
        database.init_db()
    except Exception as exc:
        print(f"DB Init Error: {exc}")

    try:
        model_service.load_model()
    except FileNotFoundError as exc:
        print(f"WARNING: {exc}")
    except Exception as exc:
        print(f"ERROR loading model: {exc}")
        traceback.print_exc()


# ──────────────────────────────────────────────
# Health check
# ──────────────────────────────────────────────
@app.get("/api/health")
async def health():
    """Health-check endpoint."""
    device = str(model_service.get_model_device()) if model_service.is_model_loaded() else "unknown"
    return {
        "status": "ok",
        "model_loaded": model_service.is_model_loaded(),
        "device": device,
    }


# ──────────────────────────────────────────────
# Statistics & History Endpoints
# ──────────────────────────────────────────────
@app.get("/api/stats")
async def get_stats():
    """Get dashboard stats (total patients, total screenings, today's screenings)."""
    return database.get_dashboard_stats()


@app.get("/api/stats/distribution")
async def get_distribution():
    """Get count distribution per DR class."""
    return database.get_screening_distribution()


@app.get("/api/screenings")
async def get_screenings():
    """Get all saved screenings."""
    return database.get_all_screenings()


@app.get("/api/screenings/recent")
async def get_recent_screenings(limit: int = 5):
    """Get recent screenings."""
    return database.get_recent_screenings(limit=limit)


# ──────────────────────────────────────────────
# Analyze endpoint
# ──────────────────────────────────────────────
@app.post("/api/analyze")
async def analyze(
    file: UploadFile = File(...),
    name: str = Form(None),
    age: int = Form(None),
    gender: str = Form(None),
    patient_id: str = Form(None),
    contact: str = Form(None),
):
    """
    Accept a retinal fundus image + optional patient details and return:
    - DR prediction (class + confidence)
    - Raw logits and Softmax probabilities for all 5 classes
    - Grad-CAM heatmap & overlay URLs
    - Saves record to SQLite database
    """

    # ── 1. Check model availability ──
    if not model_service.is_model_loaded():
        raise HTTPException(
            status_code=503,
            detail="Model is not loaded. Place retinopathy_efficientnet_b0.pth inside backend/models/ and restart the server.",
        )

    # ── 2. Read uploaded file ──
    try:
        file_bytes = await file.read()
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read uploaded file.")

    # ── 3. Validate ──
    error = validate_file(
        filename=file.filename or "",
        content_type=file.content_type or "",
        file_size=len(file_bytes),
    )
    if error:
        raise HTTPException(status_code=400, detail=error)

    # ── 4. Load & preprocess image ──
    try:
        pil_image = load_image(file_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    input_tensor = preprocess_image(pil_image)

    # ── 5. Predict ──
    try:
        prediction = model_service.predict(
            input_tensor=input_tensor,
            filename=file.filename or "unknown.jpg",
            image_size=pil_image.size,
            image_mode=pil_image.mode,
        )
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Prediction failed. Please try again.")

    # ── 6. Grad-CAM ──
    try:
        model = model_service.get_model()
        gradcam_tensor = preprocess_image(pil_image)
        cam_files = generate_gradcam_images(
            model=model,
            input_tensor=gradcam_tensor,
            original_pil_image=pil_image,
            class_idx=prediction["class_id"],
        )
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Grad-CAM generation failed.")

    heatmap_url = f"/generated/{cam_files['heatmap_filename']}"
    overlay_url = f"/generated/{cam_files['overlay_filename']}"
    explanation_msg = "Grad-CAM highlights image regions that influenced the model prediction."

    # ── 7. Save to SQLite DB ──
    db_record = database.save_screening(
        name=name,
        age=age,
        gender=gender,
        patient_id_str=patient_id,
        contact=contact,
        prediction=prediction["class_name"],
        class_id=prediction["class_id"],
        confidence=prediction["confidence"],
        heatmap_url=heatmap_url,
        overlay_url=overlay_url,
        explanation=explanation_msg,
    )

    # ── 8. Response ──
    return JSONResponse(content={
        "success": True,
        "record_id": db_record["id"],
        "patient": db_record["patient"],
        "prediction": {
            "class_id": prediction["class_id"],
            "class_name": prediction["class_name"],
            "confidence": prediction["confidence"],
        },
        "logits": prediction["logits"],
        "probabilities": prediction["probabilities"],
        "explanation": {
            "message": explanation_msg,
            "heatmap_url": heatmap_url,
            "overlay_url": overlay_url,
        },
        "date": db_record["date"],
    })


# ──────────────────────────────────────────────
# Global exception handler
# ──────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Catch-all: never expose raw Python tracebacks to the client."""
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"success": False, "detail": "An internal error occurred. Please try again."},
    )
