"""
Grad-CAM service — generates visual explanations for EfficientNet-B0 predictions.
"""

import gc
import os
import numpy as np
import torch
from PIL import Image

from utils.image_utils import generate_safe_filename

GENERATED_DIR = os.path.join(os.path.dirname(__file__), "..", "generated")


class GradCAM:
    """Small, request-scoped Grad-CAM implementation with explicit cleanup."""

    def __init__(self, model: torch.nn.Module, target_layer: torch.nn.Module):
        self.model = model
        self.target_layer = target_layer
        self._activations = None
        self._gradients = None
        self._forward_hook = target_layer.register_forward_hook(self._save_activation)
        self._backward_hook = target_layer.register_full_backward_hook(self._save_gradient)
        self._hooks_removed = False

    def _save_activation(self, module, input, output):
        self._activations = output.detach()

    def _save_gradient(self, module, grad_input, grad_output):
        self._gradients = grad_output[0].detach()

    def generate(self, input_tensor: torch.Tensor, class_idx: int | None = None) -> np.ndarray:
        self.model.eval()
        input_tensor = input_tensor.requires_grad_(True)

        output = self.model(input_tensor)
        if class_idx is None:
            class_idx = output.argmax(dim=1).item()

        self.model.zero_grad(set_to_none=True)
        output[0, class_idx].backward()

        gradients = self._gradients
        activations = self._activations
        if gradients is None or activations is None:
            raise RuntimeError("Grad-CAM hooks did not capture activations/gradients.")

        weights = gradients.mean(dim=(2, 3), keepdim=True)
        cam_tensor = torch.relu((weights * activations).sum(dim=1, keepdim=True))
        cam = cam_tensor.squeeze().detach().cpu().numpy().astype(np.float32)

        cam_min = float(cam.min())
        cam_max = float(cam.max())
        if cam_max != cam_min:
            cam = (cam - cam_min) / (cam_max - cam_min)
        else:
            cam.fill(0.0)

        # Release graph-related references before image processing.
        del output, weights, cam_tensor, gradients, activations
        return cam

    def remove_hooks(self):
        if not self._hooks_removed:
            self._forward_hook.remove()
            self._backward_hook.remove()
            self._hooks_removed = True
        self._activations = None
        self._gradients = None
        gc.collect()



def generate_gradcam_images(
    model: torch.nn.Module,
    input_tensor: torch.Tensor,
    original_pil_image: Image.Image,
    class_idx: int,
) -> dict:
    """Generate bounded-size heatmap and overlay images."""
    os.makedirs(GENERATED_DIR, exist_ok=True)

    target_layer = model.features[-1]
    cam = GradCAM(model, target_layer)

    try:
        heatmap = cam.generate(input_tensor, class_idx=class_idx)
    finally:
        cam.remove_hooks()

    orig_w, orig_h = original_pil_image.size
    heatmap_gray = Image.fromarray((heatmap * 255).clip(0, 255).astype(np.uint8))
    heatmap_resized = np.asarray(
        heatmap_gray.resize((orig_w, orig_h), Image.BILINEAR),
        dtype=np.uint8,
    )
    del heatmap, heatmap_gray

    heatmap_colored = _apply_colormap(heatmap_resized)
    heatmap_pil = Image.fromarray(heatmap_colored, mode="RGB")
    heatmap_filename = generate_safe_filename("png")
    heatmap_pil.save(os.path.join(GENERATED_DIR, heatmap_filename), optimize=True)

    original_np = np.asarray(original_pil_image, dtype=np.uint8)
    overlay_np = (
        0.5 * original_np.astype(np.float32) + 0.5 * heatmap_colored.astype(np.float32)
    ).clip(0, 255).astype(np.uint8)
    overlay_pil = Image.fromarray(overlay_np, mode="RGB")
    overlay_filename = generate_safe_filename("png")
    overlay_pil.save(os.path.join(GENERATED_DIR, overlay_filename), optimize=True)

    del heatmap_resized, heatmap_colored, original_np, overlay_np, heatmap_pil, overlay_pil
    gc.collect()

    return {
        "heatmap_filename": heatmap_filename,
        "overlay_filename": overlay_filename,
    }


def _apply_colormap(gray: np.ndarray) -> np.ndarray:
    """Apply a lightweight JET-like colormap without matplotlib/cv2."""
    t = gray.astype(np.float32) / 255.0
    r = np.clip(1.5 - np.abs(t * 4.0 - 3.0), 0, 1)
    g = np.clip(1.5 - np.abs(t * 4.0 - 2.0), 0, 1)
    b = np.clip(1.5 - np.abs(t * 4.0 - 1.0), 0, 1)
    return (np.stack([r, g, b], axis=-1) * 255).astype(np.uint8)
