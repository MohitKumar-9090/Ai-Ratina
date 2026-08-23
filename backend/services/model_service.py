"""
Model service — loads the EfficientNet-B0 retinopathy model and runs inference.
"""

import os
import torch
import torch.nn.functional as F
from torchvision import models


# ──────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────
NUM_CLASSES = 5
CLASS_NAMES = {
    0: "No DR",
    1: "Mild DR",
    2: "Moderate DR",
    3: "Severe DR",
    4: "Proliferative DR",
}

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "retinopathy_efficientnet_b0.pth")


# ──────────────────────────────────────────────
# Module-level state
# ──────────────────────────────────────────────
_model = None
_device = None


def get_device() -> torch.device:
    """Select CUDA if available, otherwise CPU."""
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def load_model() -> None:
    """
    Build EfficientNet-B0, replace the classifier head for 5 classes,
    load the trained weights, and set the model to eval mode.
    """
    global _model, _device

    _device = get_device()
    print(f"Using device: {_device}")

    # Build architecture — must exactly match the architecture used when
    # the .pth file was saved during training in Google Colab.
    _model = models.efficientnet_b0(weights=None)

    # Replace the final classifier layer to output 5 classes
    in_features = _model.classifier[1].in_features
    _model.classifier[1] = torch.nn.Linear(in_features, NUM_CLASSES)

    # Load trained weights
    resolved_path = os.path.abspath(MODEL_PATH)
    if not os.path.isfile(resolved_path):
        raise FileNotFoundError(
            f"Model weights not found at {resolved_path}. "
            "Place retinopathy_efficientnet_b0.pth inside backend/models/"
        )

    state_dict = torch.load(resolved_path, map_location=_device, weights_only=True)

    # If state_dict is wrapped inside a "state_dict" key, unwrap it
    if isinstance(state_dict, dict) and "state_dict" in state_dict:
        state_dict = state_dict["state_dict"]

    _model.load_state_dict(state_dict)
    _model.to(_device)
    _model.eval()

    print(f"Model loaded successfully from {resolved_path}")


def get_model():
    """Return the loaded model.  Raises RuntimeError if not loaded."""
    if _model is None:
        raise RuntimeError("Model has not been loaded. Call load_model() first.")
    return _model


def get_model_device() -> torch.device:
    """Return the device the model is on."""
    if _device is None:
        raise RuntimeError("Model has not been loaded.")
    return _device


def is_model_loaded() -> bool:
    """Check whether the model has been loaded."""
    return _model is not None


def predict(
    input_tensor: torch.Tensor,
    filename: str = "N/A",
    image_size: tuple = (0, 0),
    image_mode: str = "N/A",
) -> dict:
    """
    Run inference on a preprocessed input tensor (1, 3, 224, 224).

    Returns
    -------
    dict with keys:
        class_id        int   — predicted class index
        class_name      str   — human-readable class name
        confidence      float — confidence as a percentage (e.g. 72.46)
        logits          list  — raw model output logits for 5 classes
        probabilities   dict  — mapping class_name -> percentage float
    """
    model = get_model()
    device = get_model_device()

    input_tensor = input_tensor.to(device)

    with torch.no_grad():
        logits = model(input_tensor)
        probs = F.softmax(logits, dim=1)

    logits_np = logits.cpu().numpy()[0]
    probs_np = probs.cpu().numpy()[0]
    class_id = int(probs_np.argmax())
    confidence = round(float(probs_np[class_id]) * 100, 2)

    probs_dict = {
        CLASS_NAMES[i]: round(float(probs_np[i]) * 100, 2)
        for i in range(NUM_CLASSES)
    }

    # STEP 1: Complete debug output in backend terminal
    print("\n" + "=" * 55)
    print(f"Filename: {filename}")
    print(f"Original image size: {image_size[0]}x{image_size[1]}")
    print(f"Image mode: {image_mode}")
    print(f"Preprocessed tensor shape: {list(input_tensor.shape)}")
    print(f"Model output logits: {[round(float(x), 4) for x in logits_np]}")
    print("")
    for name, val in probs_dict.items():
        print(f"{name}: {val:.2f}%")
    print("")
    print(f"Predicted class: {CLASS_NAMES[class_id]} (Index: {class_id})")
    print(f"Predicted confidence: {confidence:.2f}%")
    print("=" * 55 + "\n")

    return {
        "class_id": class_id,
        "class_name": CLASS_NAMES[class_id],
        "confidence": confidence,
        "logits": [round(float(x), 4) for x in logits_np],
        "probabilities": probs_dict,
    }
