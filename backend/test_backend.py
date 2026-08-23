"""
Test script to create initial model weights file if needed and test end-to-end functionality.
"""
import os
import torch
from torchvision import models
from PIL import Image

def create_test_weights_if_missing():
    model_path = os.path.join(os.path.dirname(__file__), "models", "retinopathy_efficientnet_b0.pth")
    if not os.path.exists(model_path):
        print(f"Creating model architecture weights file for testing at {model_path}...")
        model = models.efficientnet_b0(weights=None)
        in_features = model.classifier[1].in_features
        model.classifier[1] = torch.nn.Linear(in_features, 5)
        torch.save(model.state_dict(), model_path)
        print("Test weights file created.")

def create_sample_retina_image():
    img_path = os.path.join(os.path.dirname(__file__), "test_retina.jpg")
    img = Image.new("RGB", (300, 300), color=(180, 50, 30))
    img.save(img_path)
    print(f"Created test image at {img_path}")
    return img_path

if __name__ == "__main__":
    create_test_weights_if_missing()
    create_sample_retina_image()
