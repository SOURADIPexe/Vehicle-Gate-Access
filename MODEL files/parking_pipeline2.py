import cv2                   # OpenCV for video capture, drawing, and image processing
import numpy as np            # NumPy for polygon point arrays and math operations
import time                   # For FPS calculation
from ultralytics import YOLO  # YOLOv8 model for detecting cars in parking slots
import requests               # HTTP client to send slot status updates to backend
import threading              # For running backend updates in a background thread
import queue                  # Thread-safe queue to pass updates to the backend worker


# ─────────────────────────────────────────────
# MODEL CONFIGURATION
# ─────────────────────────────────────────────

# Path to the custom-trained YOLOv8 model for parking slot detection
MODEL_PATH = "runs/parking_detect/yolov8n_parking_status/weights/best.pt"

# Class ID mapping from the model's training labels
# 0 = car (occupied), 1 = free — we only look for class 0 (cars)
CLASS_CAR = 0

# Minimum confidence threshold for a detection to be considered valid
# 0.20 = 20% confidence; lower = more sensitive but more false positives
CONF_THRESH = 0.20


# ─────────────────────────────────────────────
# SLOT ROI DEFINITIONS  (x1, y1, x2, y2)
# Each slot is defined as a polygon (quadrilateral) using 4 points.
# These coordinates map to the actual parking slot positions in the camera view.
# ⚠️  Adjust these coordinates to match your actual camera angle / frame size.
# ─────────────────────────────────────────────
SLOTS = {
    "A": {                  # Car slots (Left side of the parking area)
        "A1": np.array([(200,  68), (175, 174), (474, 174), (476,  68)], np.int32),
        "A2": np.array([(175, 174), (155, 296), (466, 296), (474, 174)], np.int32),
        "A3": np.array([(155, 296), (140, 420), (458, 420), (466, 296)], np.int32),
    },
    "B": {                  # Two-wheeler slots (Right side of the parking area)
        "B1": np.array([(795,  72), (800, 148), (1015, 148), (1008,  72)], np.int32),
        "B2": np.array([(800, 148), (806, 240), (1025, 240), (1015, 148)], np.int32),
        "B3": np.array([(806, 240), (812, 340), (1038, 340), (1025, 240)], np.int32),
    }
}


# ─────────────────────────────────────────────
# BACKEND API CONFIGURATION
# ─────────────────────────────────────────────

# URL of the Node.js backend endpoint that receives slot status updates
BACKEND_URL = "http://172.20.10.4:5000/api/slots/update"

# Thread-safe queue: main thread puts updates here, worker thread sends them to backend
# This prevents the main video loop from blocking while waiting for HTTP responses
update_queue = queue.Queue()


def backend_worker():
    """
    Runs in a background daemon thread.
    Continuously reads slot updates from the queue and POSTs them to the backend.
    Using a queue ensures HTTP calls never block or slow down the video loop.
    """
    while True:
        try:
            # Block here until an update is available in the queue
            slot_id, is_occupied = update_queue.get()

            # Convert boolean to human-readable status string
            status_text = "Occupied" if is_occupied else "Empty"

            payload = {
                "slot": slot_id,       # e.g. "A1", "B3"
                "status": status_text  # "Occupied" or "Empty"
            }

            try:
                # Send POST request to backend with 5 second timeout
                response = requests.post(BACKEND_URL, json=payload, timeout=5)

                if response.status_code in [200, 202]:
                    # 200 OK or 202 Accepted = backend successfully processed the update
                    print(f"✅ Successfully updated {slot_id} to {status_text} on the backend.")
                else:
                    # Unexpected status code — try to extract error message from response
                    try:
                        err_msg = response.json()
                    except:
                        err_msg = response.text
                    print(f"⚠️ Failed to update {slot_id}: {err_msg}")

            except requests.exceptions.RequestException as e:
                # Network error, timeout, or backend is unreachable
                print(f"❌ Error connecting to backend: {e}")

            # Mark the queue task as done (important for queue.join() if used later)
            update_queue.task_done()

        except Exception as e:
            print(f"Worker error: {e}")


# Start the backend worker thread as a daemon
# daemon=True means it automatically dies when the main program exits
threading.Thread(target=backend_worker, daemon=True).start()


def update_slot_status(slot_id, is_occupied):
    """
    Queues a slot status update to be sent to the Node.js backend.
    Non-blocking — just puts the update in the queue and returns immediately.

    :param slot_id:     The ID of the slot (e.g., "A1", "A2", "B1")
    :param is_occupied: True if a vehicle is detected in the slot, False if empty
    """
    update_queue.put((slot_id, is_occupied))


# ─────────────────────────────────────────────
# OCCUPANCY CHECK FUNCTIONS
# ─────────────────────────────────────────────

def check_a_slot(poly, car_detections):
    """
    Checks if any detected car overlaps with the given polygon slot (used for A slots).
    Tests multiple points of each bounding box — not just the center —
    to handle cases where a car partially overlaps with a slot boundary.

    :param poly:           NumPy polygon array defining the slot boundary
    :param car_detections: List of (x1, y1, x2, y2) bounding boxes from YOLO
    :returns:              True if any car overlaps this slot, False otherwise
    """
    for det in car_detections:
        x1, y1, x2, y2 = det
        cx, cy = (x1 + x2) / 2.0, (y1 + y2) / 2.0

        # Test center + bottom-center + two corners for overlap
        # This improves detection when a car is partially inside the polygon
        pts = [
            (cx, cy),             # Center of bounding box
            (cx, float(y2)),      # Bottom-center of bounding box
            (float(x1), float(y1)),  # Top-left corner
            (float(x2), float(y2))   # Bottom-right corner
        ]

        for pt in pts:
            # pointPolygonTest returns >= 0 if point is inside or on the polygon edge
            if cv2.pointPolygonTest(poly, pt, False) >= 0:
                return True  # At least one point is inside the slot → occupied

    return False  # No car points found inside this slot → empty


def check_b_slot(poly, car_detections):
    """
    Checks occupancy for B slots (two-wheelers).
    Uses the same logic as check_a_slot since detection method is identical.
    Kept separate in case B slot logic needs to diverge later (e.g. smaller overlap threshold).
    """
    return check_a_slot(poly, car_detections)


# ─────────────────────────────────────────────
# DRAWING HELPER FUNCTIONS
# ─────────────────────────────────────────────

# Color constants in BGR format (OpenCV uses BGR, not RGB)
COLOR_OCC   = (0,   0, 220)    # Red   → slot is occupied
COLOR_FREE  = (0, 200,  60)    # Green → slot is empty
COLOR_LABEL = (255, 255, 255)  # White → label text color
FONT        = cv2.FONT_HERSHEY_SIMPLEX  # Standard OpenCV font


def draw_slot(frame, poly, label, occupied):
    """
    Draws a polygon outline around a parking slot and adds a labeled status badge.

    :param frame:    The video frame to draw on
    :param poly:     NumPy polygon array (4 points) for the slot boundary
    :param label:    Slot name string (e.g. "A1", "B3")
    :param occupied: True = draw red (occupied), False = draw green (empty)
    """
    color = COLOR_OCC if occupied else COLOR_FREE

    # Draw the polygon boundary of the slot
    cv2.polylines(frame, [poly], isClosed=True, color=color, thickness=2)

    # Find the top-left corner of the polygon for label placement
    x1, y1 = np.min(poly, axis=0)

    # Build the label text shown on top of the slot
    status_text = f"{label} - {'Occupied' if occupied else 'Empty'}"

    # Measure text size to create a tight background rectangle behind it
    t_size, _ = cv2.getTextSize(status_text, FONT, 0.55, 1)

    # Draw filled color rectangle as text background (pill shape)
    cv2.rectangle(frame,
                  (int(x1), int(y1) - t_size[1] - 8),
                  (int(x1) + t_size[0] + 8, int(y1)),
                  color, -1)

    # Draw white label text on top of the colored background
    cv2.putText(frame, status_text,
                (int(x1) + 4, int(y1) - 4),
                FONT, 0.55, COLOR_LABEL, 1, cv2.LINE_AA)


def draw_dashboard(frame, a_occ, a_free, b_occ, b_free):
    """
    Draws a semi-transparent dark bar at the bottom of the frame
    showing aggregate occupied/empty counts for both slot groups.

    :param frame:  The video frame to draw on
    :param a_occ:  Number of occupied A slots
    :param a_free: Number of free A slots
    :param b_occ:  Number of occupied B slots
    :param b_free: Number of free B slots
    """
    h, w = frame.shape[:2]
    dash_h = 56  # Height of the dashboard bar in pixels

    # Create a semi-transparent dark overlay at the bottom
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, h - dash_h), (w, h), (20, 20, 20), -1)

    # Blend overlay with original frame: 75% overlay + 25% original = semi-transparent effect
    cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)

    # Draw a thin separator line above the dashboard bar
    cv2.line(frame, (0, h - dash_h), (w, h - dash_h), (80, 80, 80), 1)

    # Build summary text for each slot group
    a_text = f"A Slots  ->  Occupied: {a_occ}  |  Empty: {a_free}"
    b_text = f"B Slots  ->  Occupied: {b_occ}  |  Empty: {b_free}"

    # Draw A slot summary in green
    cv2.putText(frame, a_text, (20, h - dash_h + 22),
                FONT, 0.65, (80, 220, 120), 2, cv2.LINE_AA)

    # Draw B slot summary in blue
    cv2.putText(frame, b_text, (20, h - dash_h + 46),
                FONT, 0.65, (80, 180, 255), 2, cv2.LINE_AA)


def draw_fps(frame, fps):
    """
    Draws the current FPS value in the top-right corner of the frame
    inside a dark background box for readability.

    :param frame: The video frame to draw on
    :param fps:   Current frames-per-second value (float)
    """
    h, w = frame.shape[:2]
    text = f"FPS: {fps:.1f}"

    # Measure text size to create a snug background box
    t_size, _ = cv2.getTextSize(text, FONT, 0.7, 2)

    # Draw dark background rectangle in top-right corner
    cv2.rectangle(frame,
                  (w - t_size[0] - 16, 8),
                  (w - 4, t_size[1] + 20),
                  (20, 20, 20), -1)

    # Draw cyan FPS text on top of the dark box
    cv2.putText(frame, text,
                (w - t_size[0] - 10, t_size[1] + 14),
                FONT, 0.7, (0, 200, 255), 2, cv2.LINE_AA)


# ─────────────────────────────────────────────
# MAIN PIPELINE
# ─────────────────────────────────────────────

def run():
    """
    Main function — loads the model, opens the camera, and runs the
    frame-by-frame parking detection loop until the user quits.
    """

    # ── Load YOLO Model ──────────────────────────────────────────────────────
    print("Loading parking detection model …")
    try:
        model = YOLO(MODEL_PATH)
    except Exception as e:
        print(f"❌  Could not load model: {e}")
        return  # Exit early if model can't be loaded
    print("✅  Model loaded.")

    # ── Open Camera ──────────────────────────────────────────────────────────
    # cv2.CAP_DSHOW = DirectShow backend (Windows only); improves camera compatibility
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    if not cap.isOpened():
        print("❌  Cannot open camera (index 0).")
        return

    # Set camera resolution to 1280x720 (HD)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    # Create a resizable display window
    cv2.namedWindow("Parking Monitor", cv2.WINDOW_NORMAL)

    prev_t = time.time()   # Used for FPS calculation
    prev_status = {}       # Tracks last known status of each slot to detect changes

    # ── Main Loop ────────────────────────────────────────────────────────────
    while True:
        ret, frame = cap.read()  # Capture a single frame from the camera
        if not ret:
            print("⚠️  Frame grab failed – retrying …")
            continue  # Skip this iteration and try again

        # Save the raw camera frame to disk for debugging/tuning YOLO configs
        cv2.imwrite("last_webcam_frame.jpg", frame)

        # ── FPS Calculation ──────────────────────────────────────────────────
        now    = time.time()
        fps    = 1.0 / max(now - prev_t, 1e-6)  # Avoid division by zero with max()
        prev_t = now

        # ── YOLO Inference ───────────────────────────────────────────────────
        # Run the model on the current frame at 640px inference size
        results = model(frame, conf=CONF_THRESH, imgsz=640, verbose=False)

        # ── Extract Car Detections ───────────────────────────────────────────
        car_detections = []
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])  # Get the class ID of this detection

                # Only process detections of class 0 (car); skip class 1 (free space)
                if cls_id == CLASS_CAR:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])  # Raw bounding box

                    # Shrink bounding box by 15% on each side to reduce edge overlap noise
                    # This prevents a car parked in one slot from triggering the adjacent slot
                    w = x2 - x1
                    h = y2 - y1
                    pad_w = int(w * 0.15)  # 15% of width
                    pad_h = int(h * 0.15)  # 15% of height

                    x1 += pad_w  # Move left edge inward
                    y1 += pad_h  # Move top edge inward
                    x2 -= pad_w  # Move right edge inward
                    y2 -= pad_h  # Move bottom edge inward

                    # Only add if the shrunk box is still valid (not collapsed)
                    if x2 > x1 and y2 > y1:
                        car_detections.append((x1, y1, x2, y2))

        # Draw faint orange boxes around raw car detections (useful for debugging)
        # Comment this out in production if it looks noisy
        for det in car_detections:
            cv2.rectangle(frame, det[:2], det[2:], (200, 130, 0), 1)

        # ── Slot Occupancy Check and Drawing ─────────────────────────────────
        a_occ = a_free = b_occ = b_free = 0  # Reset counters for this frame

        # Process A slots (car slots on the left)
        for label, slot_box in SLOTS["A"].items():
            occupied = check_a_slot(slot_box, car_detections)
            draw_slot(frame, slot_box, label, occupied)

            # Only send update to backend if the status has changed since last frame
            # This avoids spamming the backend with identical updates every frame
            if label not in prev_status or prev_status[label] != occupied:
                update_slot_status(label, occupied)
                prev_status[label] = occupied  # Cache the new status

            # Tally counts for the dashboard
            if occupied:
                a_occ  += 1
            else:
                a_free += 1

        # Process B slots (two-wheeler slots on the right)
        for label, slot_box in SLOTS["B"].items():
            occupied = check_b_slot(slot_box, car_detections)
            draw_slot(frame, slot_box, label, occupied)

            # Same change-detection logic as A slots
            if label not in prev_status or prev_status[label] != occupied:
                update_slot_status(label, occupied)
                prev_status[label] = occupied

            if occupied:
                b_occ  += 1
            else:
                b_free += 1

        # ── Draw UI Overlays ─────────────────────────────────────────────────
        draw_dashboard(frame, a_occ, a_free, b_occ, b_free)  # Bottom summary bar
        draw_fps(frame, fps)                                   # FPS counter (top-right)

        # Display the annotated frame in the window
        cv2.imshow("Parking Monitor", frame)

        # Wait 1ms for a keypress; quit if 'q' or ESC is pressed
        key = cv2.waitKey(1) & 0xFF
        if key in (ord('q'), 27):  # 27 = ESC key
            break

    # ── Cleanup ──────────────────────────────────────────────────────────────
    cap.release()               # Release the camera resource
    cv2.destroyAllWindows()     # Close all OpenCV display windows
    print("Pipeline stopped.")


# ─── Entry Point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    run()