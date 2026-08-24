"""
RetinaAI Backend — FastAPI server for diabetic retinopathy screening.

Run with:
    uvicorn main:app --host 0.0.0.0 --port $PORT
"""

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
from services import model_service
from services import cloudinary_service
from services.gradcam_service import generate_gradcam_images
from utils.image_utils import load_image, preprocess_image, validate_file

load_dotenv()

DEFAULT_CORS_ORIGINS = [
    "https://ai-ratina.vercel.app",
    "https://ratinaai.netlify.app",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5174",
]

env_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
CORS_ORIGINS = list(set(DEFAULT_CORS_ORIGINS + env_origins))
DEFAULT_CORS_ORIGIN_REGEX = r"https://ai-ratina.*\.vercel\.app"
CORS_ORIGIN_REGEX = os.getenv("CORS_ORIGIN_REGEX", DEFAULT_CORS_ORIGIN_REGEX)

app = FastAPI(
    title="RetinaAI API",
    description="Explainable AI-based Diabetic Retinopathy Screening",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GENERATED_DIR = os.path.join(os.path.dirname(__file__), "generated")
os.makedirs(GENERATED_DIR, exist_ok=True)
app.mount("/generated", StaticFiles(directory=GENERATED_DIR), name="generated")

# Grad-CAM and Cloudinary uploads are intentionally processed in the background.
# This keeps /api/analyze fast and prevents Render/proxy timeout errors.
ENABLE_GRADCAM = os.getenv("ENABLE_GRADCAM", "true").strip().lower() == "true"


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


@app.get("/api/health")
async def health():
    device = str(model_service.get_model_device()) if model_service.is_model_loaded() else "unknown"
    return {
        "status": "ok",
        "model_loaded": model_service.is_model_loaded(),
        "device": device,
        "cloudinary_configured": cloudinary_service.is_cloudinary_configured(),
        "gradcam_enabled": ENABLE_GRADCAM,
        "assets_background": True,
    }


@app.get("/api/stats")
async def get_stats():
    return database.get_dashboard_stats()


@app.get("/api/stats/distribution")
async def get_distribution():
    return database.get_screening_distribution()


@app.get("/api/screenings")
async def get_screenings():
    return database.get_all_screenings()


@app.get("/api/screenings/recent")
async def get_recent_screenings(limit: int = 5):
    return database.get_recent_screenings(limit=limit)


def _make_visualization_image(pil_image):
    """Return a bounded-size copy for Grad-CAM visualization."""
    max_dimension = 1024
    if max(pil_image.size) <= max_dimension:
        return pil_image

    visual = pil_image.copy()
    visual.thumbnail((max_dimension, max_dimension))
    return visual


def _process_background_assets(screening_id, file_bytes, pil_image, prediction):
    """Generate Grad-CAM and upload assets after the API response is sent."""
    heatmap_local_url = None
    overlay_local_url = None
    cloudinary_original_url = None
    cloudinary_gradcam_url = None
    cam_files = None

    try:
        unique_id = uuid.uuid4().hex[:10]

        try:
            cloudinary_original_url = cloudinary_service.upload_image(
                file_source=file_bytes,
                folder="retinaai/retina-images",
                public_id=f"retina_{unique_id}",
            )
        except Exception as exc:
            print(f"[BACKGROUND] Original image upload warning: {exc}")
            traceback.print_exc()

        explanation_msg = "Prediction completed."

        if ENABLE_GRADCAM:
            try:
                gradcam_start = time.perf_counter()
                model = model_service.get_model()
                visualization_image = _make_visualization_image(pil_image)
                gradcam_tensor = preprocess_image(visualization_image)

                cam_files = generate_gradcam_images(
                    model=model,
                    input_tensor=gradcam_tensor,
                    original_pil_image=visualization_image,
                    class_idx=prediction["class_id"],
                )

                heatmap_local_url = f"/generated/{cam_files['heatmap_filename']}"
                overlay_local_url = f"/generated/{cam_files['overlay_filename']}"
                explanation_msg = "Grad-CAM highlights image regions that influenced the model prediction."
                print(f"[BACKGROUND] Grad-CAM completed in {time.perf_counter() - gradcam_start:.2f}s")

                local_overlay_path = os.path.join(GENERATED_DIR, cam_files["overlay_filename"])
                if os.path.isfile(local_overlay_path):
                    try:
                        cloudinary_gradcam_url = cloudinary_service.upload_image(
                            file_source=local_overlay_path,
                            folder="retinaai/gradcam",
                            public_id=f"gradcam_{unique_id}",
                        )
                    except Exception as exc:
                        print(f"[BACKGROUND] Grad-CAM upload warning: {exc}")
                        traceback.print_exc()
            except Exception as exc:
                print(f"[BACKGROUND] Grad-CAM warning: {exc}")
                traceback.print_exc()
                explanation_msg = "Prediction completed; visual explanation was temporarily unavailable."

        final_gradcam_url = cloudinary_gradcam_url or overlay_local_url or ""

        updated = database.update_screening_assets(
            screening_id=screening_id,
            heatmap_url=heatmap_local_url or "",
            overlay_url=final_gradcam_url,
            explanation=explanation_msg,
        )
        print(
            f"[BACKGROUND] Screening {screening_id} assets updated={updated}; "
            f"image={'yes' if cloudinary_original_url else 'no'}, "
            f"gradcam={'yes' if final_gradcam_url else 'no'}"
        )
    except Exception as exc:
        print(f"[BACKGROUND] Asset processing failed for screening {screening_id}: {exc}")
        traceback.print_exc()
    finally:
        gc.collect()


@app.post("/api/analyze")
async def analyze(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    name: str = Form(None),
    age: int = Form(None),
    gender: str = Form(None),
    patient_id: str = Form(None),
    contact: str = Form(None),
):
    """Analyze a retinal image without waiting for Grad-CAM/uploads."""
    total_start = time.perf_counter()
    print(f"[ANALYZE] Request received. File: {file.filename if file else 'None'}, Patient: {name or 'N/A'}")

    if not model_service.is_model_loaded():
        raise HTTPException(status_code=503, detail="AI model is not loaded on the server.")

    file_bytes = None
    pil_image = None
    input_tensor = None

    try:
        read_start = time.perf_counter()
        try:
            file_bytes = await file.read()
        except Exception as exc:
            print(f"[ANALYZE] Error reading upload: {exc}")
            raise HTTPException(status_code=400, detail="Could not read uploaded file.")

        error = validate_file(
            filename=file.filename or "",
            content_type=file.content_type or "",
            file_size=len(file_bytes),
        )
        if error:
            raise HTTPException(status_code=400, detail=error)
        print(f"[ANALYZE] Image received ({len(file_bytes)} bytes). read/validate: {time.perf_counter() - read_start:.2f}s")

        prep_start = time.perf_counter()
        try:
            pil_image = load_image(file_bytes)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        input_tensor = preprocess_image(pil_image)
        print(f"[ANALYZE] Image preprocessing: {time.perf_counter() - prep_start:.2f}s; size={pil_image.size}")

        inference_start = time.perf_counter()
        try:
            prediction = model_service.predict(
                input_tensor=input_tensor,
                filename=file.filename or "unknown.jpg",
                image_size=pil_image.size,
                image_mode=pil_image.mode,
            )
        except Exception as exc:
            print(f"[ANALYZE] Prediction error: {exc}")
            traceback.print_exc()
            raise HTTPException(status_code=500, detail="Prediction failed. Please try again.")

        print(
            f"[ANALYZE] Prediction completed in {time.perf_counter() - inference_start:.2f}s: "
            f"{prediction['class_name']} ({prediction['confidence']}%)"
        )

        db_record = None
        db_start = time.perf_counter()
        try:
            db_record = database.save_screening(
                name=name,
                age=age,
                gender=gender,
                patient_id_str=patient_id,
                contact=contact,
                prediction=prediction["class_name"],
                class_id=prediction["class_id"],
                confidence=prediction["confidence"],
                heatmap_url="",
                overlay_url="",
                explanation="Prediction completed; visual explanation is being generated.",
            )
            print(f"[ANALYZE] Database: {time.perf_counter() - db_start:.2f}s")
        except Exception as exc:
            print(f"[ANALYZE] Database warning (prediction preserved): {exc}")
            traceback.print_exc()

        record_id = db_record["id"] if db_record else None
        patient = db_record["patient"] if db_record else {
            "name": name,
            "age": age,
            "gender": gender,
            "patient_id": patient_id,
            "contact": contact,
        }
        date_value = db_record["date"] if db_record else None

        if record_id is not None:
            background_tasks.add_task(
                _process_background_assets,
                record_id,
                file_bytes,
                pil_image,
                prediction,
            )

        elapsed = time.perf_counter() - total_start
        print(f"[ANALYZE] FAST RESPONSE TOTAL: {elapsed:.2f}s")

        return JSONResponse(content={
            "success": True,
            "record_id": record_id,
            "patient": patient,
            "prediction": {
                "class_id": prediction["class_id"],
                "class_name": prediction["class_name"],
                "confidence": prediction["confidence"],
            },
            "logits": prediction["logits"],
            "probabilities": prediction["probabilities"],
            "explanation": {
                "message": "Prediction completed; visual explanation is being generated.",
                "heatmap_url": None,
                "overlay_url": None,
            },
            "image_url": "",
            "gradcam_url": "",
            "assets_pending": True,
            "date": date_value,
        })

    finally:
        input_tensor = None
        gc.collect()


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"success": False, "detail": "An internal error occurred. Please try again."},
    )
