"""
Diagnostic script to test model inference across multiple different test images.
"""
import os
import torch
import numpy as np
from PIL import Image
from services import model_service
from utils.image_utils import preprocess_image

def run_diagnosis():
    model_service.load_model()
    model = model_service.get_model()

    print("\n" + "="*60)
    print("MODEL DIAGNOSTIC REPORT — 5-CLASS EVALUATION")
    print("="*60 + "\n")

    # Generate 5 distinct test images representing different visual patterns
    test_images = []

    # Image 1: Uniform dark reddish/brown retina-like background
    img1 = Image.new("RGB", (300, 300), color=(120, 40, 20))
    test_images.append(("Image 1 (Dark Red/Brown)", img1))

    # Image 2: Bright orange/red retina background with optic disc spot
    img2 = Image.new("RGB", (500, 500), color=(200, 90, 30))
    # Draw yellow/white circle (simulated optic disc)
    img2_np = np.array(img2)
    cy, cx, r = 250, 250, 40
    y, x = np.ogrid[:500, :500]
    mask = (x - cx)**2 + (y - cy)**2 <= r**2
    img2_np[mask] = [240, 220, 150]
    test_images.append(("Image 2 (Orange/Red + Optic Disc)", Image.fromarray(img2_np)))

    # Image 3: High contrast red retina with dark exudates/hemorrhage spots
    img3_np = np.full((400, 400, 3), [180, 50, 30], dtype=np.uint8)
    # Add multiple dark spots (microaneurysms)
    np.random.seed(42)
    for _ in range(30):
        rx, ry = np.random.randint(50, 350, 2)
        img3_np[rx-5:rx+5, ry-5:ry+5] = [40, 10, 5]
    test_images.append(("Image 3 (Red + Dark Lesion Spots)", Image.fromarray(img3_np)))

    # Image 4: Bright yellow/white cotton wool spots on retina
    img4_np = np.full((400, 400, 3), [160, 60, 35], dtype=np.uint8)
    for _ in range(15):
        rx, ry = np.random.randint(50, 350, 2)
        img4_np[rx-8:rx+8, ry-8:ry+8] = [230, 220, 180]
    test_images.append(("Image 4 (Retina + Cotton Wool Spots)", Image.fromarray(img4_np)))

    # Image 5: Real test_retina.jpg if present
    test_retina_path = os.path.join(os.path.dirname(__file__), "test_retina.jpg")
    if os.path.exists(test_retina_path):
        img5 = Image.open(test_retina_path).convert("RGB")
        test_images.append(("Image 5 (File: test_retina.jpg)", img5))

    for idx, (label, img) in enumerate(test_images, 1):
        tensor = preprocess_image(img)
        res = model_service.predict(tensor, filename=label, image_size=img.size, image_mode=img.mode)
        print(f"Summary for {label}:")
        print(f"  -> Logits: {res['logits']}")
        print(f"  -> Probabilities: {res['probabilities']}")
        print(f"  -> Prediction: {res['class_name']} (Index {res['class_id']})\n")

if __name__ == "__main__":
    run_diagnosis()
