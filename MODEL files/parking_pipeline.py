import cv2
import numpy as np
import time
from ultralytics import YOLO
import requests
import threading

# ─────────────────────────────────────────────
# MODEL
# ─────────────────────────────────────────────
MODEL_PATH = "runs/parking_detect/yolov8n_parking_status/weights/best.pt"
# Class mapping from datasets3/data.yaml:  0 = car (occupied),  1 = free (empty)
CLASS_CAR  = 0
CLASS_FREE = 1
CONF_THRESH = 0.45

# ─────────────────────────────────────────────
# SLOT ROI DEFINITIONS  (x1, y1, x2, y2)
# ⚠️  Adjust these coordinates to match your
#     actual camera view / 1.jpg annotations.
# ─────────────────────────────────────────────
SLOTS = {
   "A": {
        "A1": np.array([(600, 70), (580, 240), (760, 240), (750, 70)], np.int32),
        "A2": np.array([(760, 70), (750, 240), (940, 240), (930, 70)], np.int32),
        "A3": np.array([(940, 70), (930, 240), (1120, 240), (1110, 70)], np.int32),
    },
    "B": {  # Bottom row (Two-wheeler slots)
        "B1": np.array([(650, 620), (620, 900), (900, 900), (880, 620)], np.int32),
        "B2": np.array([(900, 620), (880, 900), (1150, 900), (1130, 620)], np.int32),
        "B3": np.array([(1150, 620), (1130, 900), (1400, 900), (1380, 620)], np.int32),
    },
}



import queue

# ─────────────────────────────────────────────
# BACKEND API
# ─────────────────────────────────────────────
BACKEND_URL = "http://localhost:5000/api/slots/update"

update_queue = queue.Queue()

def backend_worker():
    while True:
        try:
            slot_id, is_occupied = update_queue.get()
            status_text = "Occupied" if is_occupied else "Empty"
            payload = {
                "slot": slot_id,
                "status": status_text
            }
            try:
                # Send the POST request to the backend
                response = requests.post(BACKEND_URL, json=payload, timeout=5)
                
                if response.status_code in [200, 202]:
                    print(f"✅ Successfully updated {slot_id} to {status_text} on the backend.")
                else:
                    try:
                        err_msg = response.json()
                    except:
                        err_msg = response.text
                    print(f"⚠️ Failed to update {slot_id}: {err_msg}")
                    
            except requests.exceptions.RequestException as e:
                print(f"❌ Error connecting to backend: {e}")
            update_queue.task_done()
        except Exception as e:
            print(f"Worker error: {e}")

threading.Thread(target=backend_worker, daemon=True).start()

def update_slot_status(slot_id, is_occupied):
    """
    Queues a slot status update to be sent to the Node.js backend.
    :param slot_id: The ID of the slot (e.g., "A1", "A2", "B1")
    :param is_occupied: Boolean True if occupied, False if empty.
    """
    update_queue.put((slot_id, is_occupied))

# ─────────────────────────────────────────────
# OCCUPANCY CHECK
# ─────────────────────────────────────────────

def check_a_slot(poly, car_detections):
    for det in car_detections:
        x1, y1, x2, y2 = det
        cx, cy = (x1 + x2) / 2.0, (y1 + y2) / 2.0
        if cv2.pointPolygonTest(poly, (cx, cy), False) >= 0 or cv2.pointPolygonTest(poly, (cx, float(y2)), False) >= 0:
            return True
    return False

def check_b_slot(poly, car_detections):
    return check_a_slot(poly, car_detections)

# ─────────────────────────────────────────────
# DRAWING HELPERS
# ─────────────────────────────────────────────
COLOR_OCC   = (0,   0, 220)    # Red  (BGR)
COLOR_FREE  = (0, 200,  60)    # Green (BGR)
COLOR_LABEL = (255, 255, 255)  # White
FONT        = cv2.FONT_HERSHEY_SIMPLEX

def draw_slot(frame, poly, label, occupied):
    color = COLOR_OCC if occupied else COLOR_FREE
    cv2.polylines(frame, [poly], isClosed=True, color=color, thickness=2)

    # Label background pill
    x1, y1 = np.min(poly, axis=0) # Get top-left-ish for label
    status_text = f"{label} - {'Occupied' if occupied else 'Empty'}"
    t_size, _ = cv2.getTextSize(status_text, FONT, 0.55, 1)
    cv2.rectangle(frame,
                  (int(x1), int(y1) - t_size[1] - 8),
                  (int(x1) + t_size[0] + 8, int(y1)),
                  color, -1)
    cv2.putText(frame, status_text,
                (int(x1) + 4, int(y1) - 4),
                FONT, 0.55, COLOR_LABEL, 1, cv2.LINE_AA)

def draw_dashboard(frame, a_occ, a_free, b_occ, b_free):
    """Draw a semi-transparent bottom bar with slot counts."""
    h, w = frame.shape[:2]
    dash_h = 56
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, h - dash_h), (w, h), (20, 20, 20), -1)
    cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)

    # Separator line
    cv2.line(frame, (0, h - dash_h), (w, h - dash_h), (80, 80, 80), 1)

    a_text = f"A Slots  ->  Occupied: {a_occ}  |  Empty: {a_free}"
    b_text = f"B Slots  ->  Occupied: {b_occ}  |  Empty: {b_free}"

    cv2.putText(frame, a_text, (20, h - dash_h + 22),
                FONT, 0.65, (80, 220, 120), 2, cv2.LINE_AA)
    cv2.putText(frame, b_text, (20, h - dash_h + 46),
                FONT, 0.65, (80, 180, 255), 2, cv2.LINE_AA)

def draw_fps(frame, fps):
    h, w = frame.shape[:2]
    text = f"FPS: {fps:.1f}"
    t_size, _ = cv2.getTextSize(text, FONT, 0.7, 2)
    cv2.rectangle(frame,
                  (w - t_size[0] - 16, 8),
                  (w - 4, t_size[1] + 20),
                  (20, 20, 20), -1)
    cv2.putText(frame, text,
                (w - t_size[0] - 10, t_size[1] + 14),
                FONT, 0.7, (0, 200, 255), 2, cv2.LINE_AA)

# ─────────────────────────────────────────────
# MAIN PIPELINE
# ─────────────────────────────────────────────

def run():
    print("Loading parking detection model …")
    try:
        model = YOLO(MODEL_PATH)
    except Exception as e:
        print(f"❌  Could not load model: {e}")
        return
    print("✅  Model loaded.")

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("❌  Cannot open camera (index 0).")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    cv2.namedWindow("Parking Monitor", cv2.WINDOW_NORMAL)

    prev_t = time.time()
    prev_status = {}

    while True:
        ret, frame = cap.read()
        if not ret:
            print("⚠️  Frame grab failed – retrying …")
            continue

        # ── FPS ──────────────────────────────────────────────
        now   = time.time()
        fps   = 1.0 / max(now - prev_t, 1e-6)
        prev_t = now

        # ── YOLO INFERENCE ───────────────────────────────────
        results = model(frame, conf=CONF_THRESH, imgsz=640, verbose=False)

        # Collect car-class detections as (x1,y1,x2,y2)
        car_detections = []
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0])
                if cls_id == CLASS_CAR:          # only "car" = occupied marker
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    car_detections.append((x1, y1, x2, y2))

        # Draw raw detections faintly (optional – comment out if noisy)
        for det in car_detections:
            cv2.rectangle(frame, det[:2], det[2:], (200, 130, 0), 1)

        # ── SLOT STATUS ───────────────────────────────────────
        a_occ = a_free = b_occ = b_free = 0

        for label, slot_box in SLOTS["A"].items():
            occupied = check_a_slot(slot_box, car_detections)
            draw_slot(frame, slot_box, label, occupied)
            
            # Send update to backend only on status change (or initial assignment)
            if label not in prev_status or prev_status[label] != occupied:
                update_slot_status(label, occupied)
                prev_status[label] = occupied

            if occupied:
                a_occ  += 1
            else:
                a_free += 1

        for label, slot_box in SLOTS["B"].items():
            occupied = check_b_slot(slot_box, car_detections)
            draw_slot(frame, slot_box, label, occupied)

            # Send update to backend only on status change (or initial assignment)
            if label not in prev_status or prev_status[label] != occupied:
                update_slot_status(label, occupied)
                prev_status[label] = occupied

            if occupied:
                b_occ  += 1
            else:
                b_free += 1

        # ── OVERLAYS ──────────────────────────────────────────
        draw_dashboard(frame, a_occ, a_free, b_occ, b_free)
        draw_fps(frame, fps)

        cv2.imshow("Parking Monitor", frame)

        # Press 'q' or ESC to quit
        key = cv2.waitKey(1) & 0xFF
        if key in (ord('q'), 27):
            break

    cap.release()
    cv2.destroyAllWindows()
    print("Pipeline stopped.")


if __name__ == "__main__":
    run()