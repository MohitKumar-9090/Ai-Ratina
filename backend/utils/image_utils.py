"""
Image utility functions for preprocessing, validation, and filename generation.
"""

import uuid
from io import BytesIO
from PIL import Image
from torchvision import transforms


# ──────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

# Exact preprocessing used during EfficientNet-B0 training (ImageNet stats)
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

preprocess_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
])


# ──────────────────────────────────────────────
# Public helpers
# ──────────────────────────────────────────────
def validate_file(filename: str, content_type: str, file_size: int) -> str | None:
    """Return an error message string if the upload is invalid, else None."""
    if not filename:
        return "No filename provided."

    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        return f"Invalid file type '.{ext}'. Allowed: JPG, JPEG, PNG."

    if content_type not in ALLOWED_MIME_TYPES:
        return f"Invalid MIME type '{content_type}'. Allowed: image/jpeg, image/png."

    if file_size > MAX_FILE_SIZE_BYTES:
        mb = file_size / (1024 * 1024)
        return f"File too large ({mb:.1f} MB). Maximum is 10 MB."

    return None


def load_image(file_bytes: bytes) -> Image.Image:
    """Open raw bytes as a PIL RGB image.  Raises ValueError on failure."""
    try:
        img = Image.open(BytesIO(file_bytes))
        img = img.convert("RGB")
        return img
    except Exception as exc:
        raise ValueError(f"Could not open image: {exc}") from exc


def preprocess_image(pil_image: Image.Image):
    """Apply the same transforms used at training time and return a 4-D tensor."""
    tensor = preprocess_transform(pil_image)
    return tensor.unsqueeze(0)  # add batch dimension → (1, 3, 224, 224)


def generate_safe_filename(suffix: str = "png") -> str:
    """Return a UUID-based filename to avoid collisions."""
    return f"{uuid.uuid4().hex}.{suffix}"
