"""
Grad-CAM service — generates visual explanations for EfficientNet-B0 predictions.

Target layer: model.features[-1]  (the last convolutional block)
"""

import os
import numpy as np
import torch
from PIL import Image

from utils.image_utils import generate_safe_filename

# Directory where generated heatmaps/overlays are saved
GENERATED_DIR = os.path.join(os.path.dirname(__file__), "..", "generated")


class GradCAM:
    """
    Reusable Grad-CAM implementation.

    Usage:
        cam = GradCAM(model, target_layer)
        heatmap = cam.generate(input_tensor, class_idx)
    """

    def __init__(self, model: torch.nn.Module, target_layer: torch.nn.Module):
        self.model = model
        self.target_layer = target_layer

        self._activations = None
        self._gradients = None

        # Register hooks
        self._forward_hook = target_layer.register_forward_hook(self._save_activation)
        self._backward_hook = target_layer.register_full_backward_hook(self._save_gradient)

    # ── Hook callbacks ──────────────────────────
    def _save_activation(self, module, input, output):
        self._activations = output.detach()

    def _save_gradient(self, module, grad_input, grad_output):
        self._gradients = grad_output[0].detach()

    # ── Core ────────────────────────────────────
    def generate(self, input_tensor: torch.Tensor, class_idx: int | None = None) -> np.ndarray:
        """
        Compute the Grad-CAM heatmap for *input_tensor* (1, C, H, W).

        Parameters
        ----------
        input_tensor : torch.Tensor
            Preprocessed input (batch size 1).
        class_idx : int or None
            Target class.  If None, uses the predicted class.

        Returns
        -------
        heatmap : np.ndarray  (H_feat, W_feat) float32 in [0, 1]
        """
        self.model.eval()
        input_tensor = input_tensor.requires_grad_(True)

        # Forward
        output = self.model(input_tensor)

        if class_idx is None:
            class_idx = output.argmax(dim=1).item()

        # Backward for the target class
        self.model.zero_grad()
        target = output[0, class_idx]
        target.backward()

        # Grad-CAM math
        gradients = self._gradients  # (1, C, H, W)
        activations = self._activations  # (1, C, H, W)

        weights = gradients.mean(dim=(2, 3), keepdim=True)  # GAP over spatial dims
        cam = (weights * activations).sum(dim=1, keepdim=True)  # weighted combination
        cam = torch.relu(cam)  # ReLU
        cam = cam.squeeze().cpu().numpy()

        # Normalize to [0, 1]
        if cam.max() != cam.min():
            cam = (cam - cam.min()) / (cam.max() - cam.min())
        else:
            cam = np.zeros_like(cam)

        return cam.astype(np.float32)

    def remove_hooks(self):
        """Remove forward/backward hooks to free memory."""
        self._forward_hook.remove()
        self._backward_hook.remove()


# ──────────────────────────────────────────────
# Helper: generate & save visualizations
# ──────────────────────────────────────────────
def generate_gradcam_images(
    model: torch.nn.Module,
    input_tensor: torch.Tensor,
    original_pil_image: Image.Image,
    class_idx: int,
) -> dict:
    """
    Run Grad-CAM and save heatmap + overlay images.

    Returns
    -------
    dict with keys  heatmap_filename, overlay_filename
    """
    os.makedirs(GENERATED_DIR, exist_ok=True)

    target_layer = model.features[-1]
    cam = GradCAM(model, target_layer)

    try:
        heatmap = cam.generate(input_tensor, class_idx=class_idx)
    finally:
        cam.remove_hooks()

    orig_w, orig_h = original_pil_image.size

    # Resize heatmap to original image dimensions
    heatmap_resized = np.array(
        Image.fromarray((heatmap * 255).astype(np.uint8)).resize(
            (orig_w, orig_h), Image.BILINEAR
        )
    )

    # ── Heatmap image (colorized) ──
    heatmap_colored = _apply_colormap(heatmap_resized)
    heatmap_pil = Image.fromarray(heatmap_colored)

    heatmap_filename = generate_safe_filename("png")
    heatmap_pil.save(os.path.join(GENERATED_DIR, heatmap_filename))

    # ── Overlay image (heatmap blended onto original) ──
    original_np = np.array(original_pil_image.resize((orig_w, orig_h)))
    overlay_np = (0.5 * original_np + 0.5 * heatmap_colored).astype(np.uint8)
    overlay_pil = Image.fromarray(overlay_np)

    overlay_filename = generate_safe_filename("png")
    overlay_pil.save(os.path.join(GENERATED_DIR, overlay_filename))

    return {
        "heatmap_filename": heatmap_filename,
        "overlay_filename": overlay_filename,
    }


def _apply_colormap(gray: np.ndarray) -> np.ndarray:
    """
    Apply a JET-like colormap to a single-channel uint8 image.
    Returns an RGB uint8 ndarray of the same spatial shape.

    Avoids importing matplotlib/cv2 — lightweight pure-numpy version.
    """
    # Normalize to [0, 1]
    t = gray.astype(np.float32) / 255.0

    # JET approximation
    r = np.clip(1.5 - np.abs(t * 4.0 - 3.0), 0, 1)
    g = np.clip(1.5 - np.abs(t * 4.0 - 2.0), 0, 1)
    b = np.clip(1.5 - np.abs(t * 4.0 - 1.0), 0, 1)

    rgb = np.stack([r, g, b], axis=-1)
    return (rgb * 255).astype(np.uint8)
