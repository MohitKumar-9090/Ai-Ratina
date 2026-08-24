"""RetinaAI FastAPI backend."""
import gc
import os
import time
import traceback
import uuid

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

import database
from services import cloudinary_service, model_service
from services.gradcam_service import generate_gradcam_images
from utils.image_utils import load_image, preprocess_image, validate_file

load_dotenv()

DEFAULT_CORS_ORIGINS = [
    "https://ai-ratina.vercel.app", "https://ratinaai.netlify.app",
    "http://localhost:5173", "http://localhost:3000", "http://localhost:5174",
    "http://127.0.0.1:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5174",
]
env_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
CORS_ORIGINS = list(set(DEFAULT_CORS_ORIGINS + env_origins))

app = FastAPI(title="RetinaAI API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=os.getenv("CORS_ORIGIN_REGEX", r"https://ai-ratina.*\.vercel\.app"),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GENERATED_DIR = os.path.join(os.path.dirname(__file__), "generated")
os.makedirs(GENERATED_DIR, exist_ok=True)
app.mount("/generated", StaticFiles(directory=GENERATED_DIR), name="generated")

# Grad-CAM is disabled intentionally: prediction uses SQLite only and must stay reliable.
ENABLE_GRADCAM = False

@app.on_event("startup")
async def startup_event():
    try:
        database.init_db()
    except Exception as exc:
        print(f"DB Init Error: {exc}")
    try:
        model_service.load_model()
    except Exception as exc:
        print(f"ERROR loading model: {exc}")
        traceback.print_exc()

@app.get("/api/health")
async def health():
    device = str(model_service.get_model_device()) if model_service.is_model_loaded() else "unknown"
    return {
        "status": "ok",
        "model_loaded": model_service.is_model_loaded(),
        "device": device,
        "cloudinary_configured": cloudinary_service.is_cloudinary_configured(),
        "gradcam_enabled": False,
        "assets_background": False,
    }

@app.get("/api/stats")
async def get_stats(): return database.get_dashboard_stats()

@app.get("/api/stats/distribution")
async def get_distribution(): return database.get_screening_distribution()

@app.get("/api/screenings")
async def get_screenings(): return database.get_all_screenings()

@app.get("/api/screenings/recent")
async def get_recent_screenings(limit: int = 5): return database.get_recent_screenings(limit=limit)

@app.post("/api/analyze")
async def analyze(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    name: str = Form(None), age: int = Form(None), gender: str = Form(None),
    patient_id: str = Form(None), contact: str = Form(None),
):
    total_start = time.perf_counter()
    print(f"[ANALYZE] Request received. File: {file.filename if file else 'None'}, Patient: {name or 'N/A'}")

    if not model_service.is_model_loaded():
        raise HTTPException(status_code=503, detail="AI model is not loaded on the server.")

    try:
        file_bytes = await file.read()
        error = validate_file(file.filename or "", file.content_type or "", len(file_bytes))
        if error: raise HTTPException(status_code=400, detail=error)

        pil_image = load_image(file_bytes)
        input_tensor = preprocess_image(pil_image)
        prediction = model_service.predict(
            input_tensor=input_tensor,
            filename=file.filename or "unknown.jpg",
            image_size=pil_image.size,
            image_mode=pil_image.mode,
        )

        # SQLite is the single persistence layer. No Firebase and no Grad-CAM dependency.
        screening = database.save_screening(
            name=name or "Anonymous Patient",
            age=age,
            gender=gender,
            patient_id_str=patient_id,
            contact=contact,
            prediction=prediction["class_name"],
            class_id=prediction["class_id"],
            confidence=prediction["confidence"],
            heatmap_url="",
            overlay_url="",
            explanation="AI prediction completed. Grad-CAM is disabled.",
        )

        response = {
            "success": True,
            "record_id": screening["id"],
            "patient": screening["patient"],
            "prediction": {
                "class_id": prediction["class_id"],
                "class_name": prediction["class_name"],
                "confidence": prediction["confidence"],
            },
            "logits": prediction.get("logits"),
            "probabilities": prediction.get("probabilities"),
            "image_url": "",
            "gradcam_url": "",
            "explanation": {
                "message": "AI prediction completed. Grad-CAM is disabled.",
                "heatmap_url": "",
                "overlay_url": "",
            },
            "assets_pending": False,
            "date": screening["date"],
            "processing_time": round(time.perf_counter() - total_start, 2),
        }
        print(f"[ANALYZE] Completed in {response['processing_time']}s; Grad-CAM skipped")
        return JSONResponse(content=response)

    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        print(f"[ANALYZE] Error: {exc}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(exc)}")
    finally:
        gc.collect()

@app.get("/")
async def root():
    return {"service": "RetinaAI API", "status": "running", "gradcam": False}
