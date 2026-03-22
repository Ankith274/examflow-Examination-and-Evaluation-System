import base64
import numpy as np
import cv2
from PIL import Image
import io


def base64_to_frame(b64_string: str) -> np.ndarray:
    """Convert base64 image string to OpenCV BGR frame."""
    # Strip data URL prefix if present
    if "," in b64_string:
        b64_string = b64_string.split(",")[1]
    img_bytes = base64.b64decode(b64_string)
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    frame = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    return frame


def frame_to_base64(frame: np.ndarray) -> str:
    """Convert OpenCV BGR frame to base64 JPEG string."""
    _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
    return base64.b64encode(buffer).decode("utf-8")


def resize_frame(frame: np.ndarray, max_width: int = 640) -> np.ndarray:
    """Resize frame maintaining aspect ratio."""
    h, w = frame.shape[:2]
    if w <= max_width:
        return frame
    scale = max_width / w
    return cv2.resize(frame, (max_width, int(h * scale)))
