import cv2                          # OpenCV for image/video processing
import numpy as np                    # NumPy for array operations
import time                           # For FPS calculation and timestamps
import re                             # Regex for cleaning OCR text
import easyocr                        # OCR engine to read text from plate images
import os                             # OS utilities (not directly used but good to keep)
import threading                      # For running OCR in background without blocking main loop
from ultralytics import YOLO          # YOLOv8 model for vehicle classification and plate detection
import requests                       # HTTP client to send plate data to backend
import datetime                       # For generating ISO timestamps when syncing to server


# ─── Backend API Configuration ────────────────────────────────────────────────
# URL of the MERN backend endpoint that receives detected plate data
API_URL = "http://localhost:5000/api/plates"


def send_to_backend(plate_text, vehicle_type):
    """
    Sends detected plate info to the MERN backend via HTTP POST.
    Runs in a separate thread so it doesn't block the main video loop.
    """
    payload = {
        "plateNumber": plate_text,          # Cleaned plate number (e.g. DL3CAB1234)
        "vehicleType": vehicle_type,        # "2W" for two-wheeler, "4W" for four-wheeler
        "location": "Main Gate Camera",     # Static label for camera location
        "timestamp": datetime.datetime.now().isoformat()  # Current time in ISO format
    }
    try:
        response = requests.post(API_URL, json=payload, timeout=5)  # 5s timeout to avoid hanging
        if response.status_code == 201:
            print(f"☁️  Synced with Server: {plate_text}")          # 201 = successfully created
        else:
            print(f"⚠️  Server Error: {response.status_code}")      # Unexpected server response
    except Exception as e:
        print(f"❌ Connection Failed: {e}")                          # Network error or server down


# ─── Camera Configuration ─────────────────────────────────────────────────────
CAMERA_INDEX = 0  # 0 = default webcam; change to 1, 2 etc. for external cameras


# ─── Indian State Codes ───────────────────────────────────────────────────────
# All valid 2-letter state/UT codes used in Indian vehicle registration plates
INDIAN_STATES = [
    "AP", "AR", "AS", "BR", "CG", "GA", "GJ", "HR", "HP", "JH",
    "KA", "KL", "MP", "MH", "MN", "ML", "MZ", "NL", "OD", "PB",
    "RJ", "SK", "TN", "TS", "TR", "UP", "UK", "WB", "DL", "CH",
    "PY", "JK", "LA"
]


# ─── YOLO Model File Paths ────────────────────────────────────────────────────
# Custom-trained YOLOv8 models for vehicle classification and plate detection
MODEL_PATHS = {
    "vehicle": "runs/classify/yolov8n_cls_benchmark/weights/best.pt",  # Classifies 2W vs 4W
    "plate":   "runs/detect/yolov8n_plate_detect/weights/best.pt",     # Detects plate bounding box
}


# ─── Shared State Variables (used across threads) ─────────────────────────────
current_plate = ""              # Last successfully detected and validated plate number
current_vehicle_type = "Unknown"  # Vehicle type corresponding to last plate
current_ocr_time = "0.00s"     # Time taken for last OCR operation (displayed on screen)
is_ocr_running = False          # Flag to prevent launching multiple OCR threads simultaneously


# ─── Deduplication / Anti-Spam Logic ─────────────────────────────────────────
plate_buffer = {}               # Tracks how many consecutive times each plate has been seen
saved_plates_cache = {}         # Tracks last time each plate was saved (for cooldown)
STABILITY_THRESHOLD = 3         # Plate must be detected this many times before it's accepted
COOLDOWN_SECONDS = 30           # Minimum seconds before the same plate is logged again


# ─── Load YOLO Models ─────────────────────────────────────────────────────────
print("Loading YOLO models...")
try:
    vehicle_model = YOLO(MODEL_PATHS["vehicle"])  # Load classification model
    plate_model   = YOLO(MODEL_PATHS["plate"])    # Load detection model
except Exception as e:
    print(f"❌ Error loading YOLO: {e}")
    exit()  # Can't continue without models


# ─── Load EasyOCR ─────────────────────────────────────────────────────────────
print("Loading EasyOCR...")
ocr_reader = easyocr.Reader(['en'], gpu=True)  # English only; set gpu=False if no CUDA GPU
print("✅ Models + OCR Loaded")


# ─── Character Correction for Indian Plates ───────────────────────────────────
def fix_confusing_chars(text):
    """
    Corrects commonly misread characters based on position in Indian plate format.
    Indian plate format: SS-DD-LL-NNNN (State, District, Letters, Numbers)
      - Positions 0-1: State code → must be letters
      - Positions 2-3: District number → must be digits
      - Last 4: Serial number → must be digits
    """
    text_list = list(text)
    length = len(text_list)

    # Maps digits that look like letters → used to fix letter positions
    dict_int_to_char = {'0': 'O', '1': 'I', '5': 'S', '8': 'B', '4': 'A', '6': 'G', '2': 'Z', '3': 'J'}

    # Maps letters that look like digits → used to fix digit positions
    dict_char_to_int = {'O': '0', 'Q': '0', 'D': '0', 'I': '1', 'J': '3', 'A': '4', 'G': '6', 'S': '5', 'B': '8', 'Z': '2'}

    # Fix first 2 characters → should be letters (state code)
    for i in range(min(length, 2)):
        if text_list[i] in dict_int_to_char:
            text_list[i] = dict_int_to_char[text_list[i]]

    if length >= 4:
        # Fix characters at position 2-3 → should be digits (district code)
        for i in range(2, 4):
            if text_list[i] in dict_char_to_int:
                text_list[i] = dict_char_to_int[text_list[i]]

        # Fix last 4 characters → should be digits (serial number)
        for i in range(length - 4, length):
            if text_list[i] in dict_char_to_int:
                text_list[i] = dict_char_to_int[text_list[i]]

    # Fix middle characters (series letters, e.g. "AB") → '0' → 'Q' to avoid digit confusion
    if length > 6:
        for i in range(4, length - 4):
            if text_list[i] == '0':
                text_list[i] = 'Q'

    return "".join(text_list)


def clean_indian_plate(text_list):
    """
    Takes raw OCR output (list of strings) and returns a cleaned, validated plate number.
    Returns empty string if the plate doesn't match Indian format.
    """
    if not text_list:
        return ""

    # Join all OCR tokens and uppercase everything
    text = "".join(text_list).upper()

    # Remove "IND" watermark sometimes printed on Indian plates
    text = text.replace("IND", "")

    # Strip all non-alphanumeric characters (spaces, dashes, dots etc.)
    text = re.sub(r"[^A-Z0-9]", "", text)

    # Indian plates are 8–10 characters long; reject anything outside this range
    if len(text) < 8 or len(text) > 10:
        return ""

    # Apply character-level corrections based on position
    text = fix_confusing_chars(text)

    # Validate that first 2 chars are a known Indian state code
    if text[:2] not in INDIAN_STATES:
        return ""

    return text


def preprocess_for_ocr(img):
    """
    Enhances the cropped plate image to improve OCR accuracy.
    Steps: upscale → sharpen → grayscale → binarize (Otsu threshold)
    """
    if img is None or img.size == 0:
        return None

    # Upscale 3x for better OCR readability on small plates
    img = cv2.resize(img, None, fx=3.0, fy=3.0, interpolation=cv2.INTER_CUBIC)

    # Convert to grayscale for processing
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Sharpening kernel to enhance edges and character boundaries
    kernel = np.array([[0, -1, 0],
                       [-1, 5, -1],
                       [0, -1, 0]])
    gray = cv2.filter2D(gray, -1, kernel)

    # Otsu's binarization: automatically finds best threshold for black/white split
    gray = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]

    return gray


# ─── OCR Worker (runs in a background thread) ─────────────────────────────────
def ocr_worker(crop, vtype):
    """
    Performs OCR on a cropped plate image in a background thread.
    Uses deduplication logic to avoid saving the same plate repeatedly.
    Updates global state when a new valid plate is confidently detected.
    """
    global current_plate, current_vehicle_type, is_ocr_running, plate_buffer, saved_plates_cache, current_ocr_time

    start_time = time.time()  # Start timer to measure OCR duration

    try:
        # Preprocess the plate crop for better OCR accuracy
        proc = preprocess_for_ocr(crop)

        if proc is not None:
            # Run OCR — only allow characters valid in Indian plates
            raw = ocr_reader.readtext(
                proc,
                detail=0,  # Return text only (no bounding boxes)
                allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"  # Restrict character set
            )

            # Clean and validate the OCR output
            cleaned = clean_indian_plate(raw)

            if cleaned:
                # ── Stability Check ──────────────────────────────────────────
                # Increment how many times this plate has been consecutively seen
                plate_buffer[cleaned] = plate_buffer.get(cleaned, 0) + 1

                # Only proceed if plate has been seen enough times (reduces false positives)
                if plate_buffer[cleaned] >= STABILITY_THRESHOLD:
                    now = time.time()
                    last_saved = saved_plates_cache.get(cleaned, 0)

                    # ── Cooldown Check ───────────────────────────────────────
                    # Don't log the same plate again if it was recently saved
                    if (now - last_saved) > COOLDOWN_SECONDS:

                        # Calculate total OCR processing time
                        end_time = time.time()
                        time_taken_s = end_time - start_time
                        time_str = f"{time_taken_s:.2f}s"

                        # Update global display variables
                        current_plate = cleaned
                        current_vehicle_type = vtype
                        current_ocr_time = time_str

                        # Mark this plate as saved and reset its stability counter
                        saved_plates_cache[cleaned] = now
                        plate_buffer[cleaned] = 0

                        # Print result to terminal
                        print(f"🚀 DETECTED: {cleaned} | {vtype} | Time: {time_str}")

                        # Send plate data to MERN backend in a new thread
                        threading.Thread(target=send_to_backend, args=(cleaned, vtype)).start()

    except Exception as e:
        print(f"OCR Error: {e}")

    finally:
        # Always release the OCR lock so next frame can trigger OCR
        is_ocr_running = False


# ─── Main Video Loop ──────────────────────────────────────────────────────────
def run():
    """
    Main function — captures video frames, runs YOLO detection, and triggers OCR.
    Displays annotated video feed with plate info and FPS counter.
    """
    global is_ocr_running, current_plate, saved_plates_cache, current_ocr_time

    # Open camera feed
    cap = cv2.VideoCapture(CAMERA_INDEX)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)   # Set resolution width
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)   # Set resolution height

    prev_frame_time = 0     # Used to calculate FPS
    last_cls_time = 0       # Timestamp of last vehicle classification
    cached_vtype = "Unknown"  # Stores last classified vehicle type between frames

    # Create resizable display window
    cv2.namedWindow("Indian ANPR", cv2.WINDOW_NORMAL)

    while True:
        ret, frame = cap.read()  # Read one frame from the camera
        if not ret:
            break  # Exit if camera disconnects or video ends

        # ── Periodic Cache Cleanup ───────────────────────────────────────────
        # Remove plate entries older than 1 hour to prevent memory buildup
        t_now = time.time()
        if int(t_now) % 60 == 0:  # Run cleanup roughly every minute
            saved_plates_cache = {
                k: v for k, v in saved_plates_cache.items()
                if t_now - v < 3600  # Keep only entries from last 3600 seconds (1 hour)
            }

        annotated = frame.copy()  # Work on a copy to keep original frame clean

        # ── FPS Calculation ──────────────────────────────────────────────────
        new_frame_time = time.time()
        fps = 1 / (new_frame_time - prev_frame_time) if prev_frame_time > 0 else 0
        prev_frame_time = new_frame_time

        # ── Vehicle Classification (runs every 1 second to save CPU) ────────
        if time.time() - last_cls_time > 1.0:
            try:
                results = vehicle_model(frame, verbose=False)  # Run classifier on full frame
                if results and results[0].probs:
                    probs = results[0].probs.data.cpu().numpy()  # Get class probabilities
                    cached_vtype = ["2W", "4W"][np.argmax(probs)]  # Pick highest probability class
                    last_cls_time = time.time()
            except:
                pass  # Silently skip if classification fails

        # ── Plate Detection ──────────────────────────────────────────────────
        results = plate_model(frame, conf=0.45, imgsz=640, verbose=False)
        # conf=0.45: only consider detections with 45%+ confidence
        # imgsz=640: inference at 640px (standard YOLOv8 size)

        for r in results:
            for b in r.boxes:
                # Get bounding box coordinates
                x1, y1, x2, y2 = map(int, b.xyxy[0])

                # ── Expand Bounding Box with Padding ─────────────────────────
                # Plates are often tightly detected; adding padding improves OCR
                w_box, h_box = x2 - x1, y2 - y1
                pad_x = int(w_box * 0.15)  # 15% horizontal padding
                pad_y = int(h_box * 0.25)  # 25% vertical padding

                # Clamp coordinates to stay within frame boundaries
                h_img, w_img, _ = frame.shape
                x1, y1 = max(0, x1 - pad_x), max(0, y1 - pad_y)
                x2, y2 = min(w_img, x2 + pad_x), min(h_img, y2 + pad_y)

                # Draw green bounding box around the detected plate
                cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)

                # ── Trigger OCR in Background Thread ─────────────────────────
                # Only start a new OCR thread if one isn't already running
                if not is_ocr_running:
                    crop = frame[y1:y2, x1:x2]  # Crop the plate region from frame
                    if crop.size > 0:
                        is_ocr_running = True
                        threading.Thread(
                            target=ocr_worker,
                            args=(crop, cached_vtype),
                            daemon=True  # Thread dies automatically when main program exits
                        ).start()

                # ── Display Plate Text Above Bounding Box ────────────────────
                if current_plate:
                    # Calculate text size for background rectangle
                    t_size = cv2.getTextSize(current_plate, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)[0]
                    # Draw filled green rectangle as text background
                    cv2.rectangle(annotated, (x1, y1 - 30), (x1 + t_size[0] + 10, y1), (0, 200, 0), -1)
                    # Draw white plate text on top of green background
                    cv2.putText(annotated, current_plate, (x1 + 5, y1 - 8),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

                break  # Only process the first detected plate per frame

        # ── Status Bar at Top of Frame ───────────────────────────────────────
        # Shows last detected plate, vehicle type, and OCR time
        if current_plate:
            cv2.rectangle(annotated, (0, 0), (1280, 50), (0, 0, 0), -1)  # Black background bar
            cv2.putText(
                annotated,
                f"LAST: {current_plate} | {cached_vtype} | {current_ocr_time}",
                (20, 35),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2
            )

        # ── FPS Display (top-right corner) ───────────────────────────────────
        cv2.putText(annotated, f"FPS: {int(fps)}", (1150, 40),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

        # ── Show Frame ───────────────────────────────────────────────────────
        cv2.imshow("Indian ANPR", annotated)

        # Press 'q' to quit the application
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    # ── Cleanup ──────────────────────────────────────────────────────────────
    cap.release()               # Release camera resource
    cv2.destroyAllWindows()     # Close all OpenCV windows


# ─── Entry Point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    run()