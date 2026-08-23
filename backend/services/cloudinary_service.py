"""
Cloudinary service — handles image uploads for original retina scans and Grad-CAM visualizations.
"""

import os
import traceback
import cloudinary
import cloudinary.uploader


def is_cloudinary_configured() -> bool:
    """Check if Cloudinary environment variables are set."""
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
    api_key = os.getenv("CLOUDINARY_API_KEY")
    api_secret = os.getenv("CLOUDINARY_API_SECRET")
    return bool(cloud_name and api_key and api_secret and cloud_name != "your_cloud_name")


# Initialize Cloudinary if credentials exist
if is_cloudinary_configured():
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
        api_secret=os.getenv("CLOUDINARY_API_SECRET"),
        secure=True,
    )
    print(f"[Cloudinary] Configured successfully with cloud name: {os.getenv('CLOUDINARY_CLOUD_NAME')}")
else:
    print("[Cloudinary] Credentials not set in environment. Running in local image fallback mode.")


def upload_image(file_source: bytes | str, folder: str, public_id: str = None) -> str | None:
    """
    Upload an image (bytes or file path) to Cloudinary.

    Parameters
    ----------
    file_source : bytes or str
        Raw image bytes or absolute file path.
    folder : str
        Cloudinary folder (e.g., 'retinaai/retina-images' or 'retinaai/gradcam').
    public_id : str, optional
        Unique public ID for the uploaded asset.

    Returns
    -------
    str or None
        Cloudinary secure URL on success, or None on failure.
    """
    if not is_cloudinary_configured():
        return None

    try:
        options = {
            "folder": folder,
            "overwrite": True,
            "resource_type": "image",
            "timeout": 15,  # Non-blocking timeout to prevent long-running hangs
        }
        if public_id:
            options["public_id"] = public_id

        response = cloudinary.uploader.upload(file_source, **options)
        secure_url = response.get("secure_url")
        print(f"[Cloudinary] Uploaded successfully to {folder}/{public_id or ''}: {secure_url}")
        return secure_url
    except Exception as exc:
        print(f"[Cloudinary] Upload error for {folder}: {exc}")
        traceback.print_exc()
        return None
