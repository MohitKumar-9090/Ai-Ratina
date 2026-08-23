# RetinaAI Backend

FastAPI backend for the RetinaAI Diabetic Retinopathy Screening System.

## Prerequisites

- Python 3.10+
- pip

## Setup

### 1. Create a virtual environment

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

> **Note:** If you have an NVIDIA GPU, install the CUDA version of PyTorch for faster inference:
> ```bash
> pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
> ```

### 3. Place the model file

Copy the trained EfficientNet-B0 weights into:

```
backend/models/retinopathy_efficientnet_b0.pth
```

> **Do NOT rename the file.** The backend expects exactly this filename.

### 4. Configure CORS (optional)

Copy `.env.example` to `.env` and edit as needed:

```bash
cp .env.example .env
```

Default allows `http://localhost:5173` (Vite dev server).

### 5. Start the server

```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.

---

## API Endpoints

### Health Check

```
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "model_loaded": true,
  "device": "cuda"
}
```

### Analyze Retinal Image

```
POST /api/analyze
```

**Request:** `multipart/form-data` with field `file` (JPG/JPEG/PNG, max 10 MB)

**Example with curl:**

```bash
curl -X POST -F "file=@retina_image.jpg" http://localhost:8000/api/analyze
```

**Response:**
```json
{
  "success": true,
  "prediction": {
    "class_id": 2,
    "class_name": "Moderate DR",
    "confidence": 84.32
  },
  "explanation": {
    "message": "Grad-CAM highlights image regions that influenced the model prediction.",
    "heatmap_url": "/generated/abc123.png",
    "overlay_url": "/generated/def456.png"
  }
}
```

### Generated Images

Grad-CAM heatmaps and overlays are served at:

```
GET /generated/<filename>.png
```

---

## How the React Frontend Connects

1. The frontend sets `VITE_API_URL=http://localhost:8000` in the project root `.env`.
2. On the Analyze page, the user uploads a retinal image.
3. The frontend sends a `POST /api/analyze` request with the image as `FormData`.
4. The backend returns prediction results and Grad-CAM image URLs.
5. The frontend displays the prediction, confidence, and Grad-CAM overlay.

---

## Class Mapping

| Class ID | Name              |
|----------|-------------------|
| 0        | No DR             |
| 1        | Mild DR           |
| 2        | Moderate DR       |
| 3        | Severe DR         |
| 4        | Proliferative DR  |

---

## Project Structure

```
backend/
├── main.py                  # FastAPI application
├── requirements.txt         # Python dependencies
├── .env                     # Environment configuration
├── .env.example             # Example env file
├── models/
│   └── retinopathy_efficientnet_b0.pth  # Trained model weights (place manually)
├── services/
│   ├── model_service.py     # Model loading and inference
│   └── gradcam_service.py   # Grad-CAM generation
├── utils/
│   └── image_utils.py       # Image preprocessing and validation
└── generated/               # Temporary Grad-CAM output images
```

---

## Medical Disclaimer

AI-assisted screening only. This prototype does not replace professional ophthalmic evaluation.
