from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel
from src.RemoteControl import RemoteControl
from typing import Optional
import urllib.parse
import requests
import os
import shutil
from datetime import datetime
import uuid
from pathlib import Path
import csv
import cv2
import cv2.aruco as aruco
import numpy as np
import time

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

HOST = os.getenv("SMARTPHONE_HOST", "192.168.4.245")

# In-memory store for active sessions
sessions: dict[str, RemoteControl] = {}

class StartRequest(BaseModel):
    session_id: str
    name: Optional[str] = None
    save_path: Optional[str] = None
    duration: Optional[float] = None
    exposure: Optional[int] = None

class StartResponse(BaseModel):
    session_id: str
    duration: float
    exposure: int

class StopRecordingRequest(BaseModel):
    session_id: str
    name: str
    save_path: str

class EndSessionRequest(BaseModel):
    save_path: str
    session_id: str

# --- NEW: Pydantic models for calibration endpoints ---
class CaptureRequest(BaseModel):
    study_id: str
    session_id: str
    duration: int = 5

class ProcessRequest(BaseModel):
    study_id: str
    session_id: str

app.mount("/videos", StaticFiles(directory="C:/Videos/Test Video Data"), name="videos")

# --- NEW: Calibration board and file path configuration ---
VIDEO_SAVE_PATH = Path("calibration_videos")
CALIBRATION_PARAMS_PATH = Path("calibration_data")

os.makedirs(VIDEO_SAVE_PATH, exist_ok=True)
os.makedirs(CALIBRATION_PARAMS_PATH, exist_ok=True)

ARUCO_DICT = aruco.getPredefinedDictionary(aruco.DICT_6X6_250)
SQUARES_VERTICALLY = 7
SQUARES_HORIZONTALLY = 5
SQUARE_LENGTH = 0.04  # In meters
MARKER_LENGTH = 0.02   # In meters

board = aruco.CharucoBoard((SQUARES_HORIZONTALLY, SQUARES_VERTICALLY), SQUARE_LENGTH, MARKER_LENGTH, ARUCO_DICT)
charuco_detector = aruco.CharucoDetector(board)

@app.get("/config")
def get_config():
    return {"host": HOST}

@app.post("/start-recording", response_model=StartResponse)
def start_recording(req: StartRequest):
    print(f"Received start request: {req}")
    
    # Your RemoteControl logic here, for now dummy values:
    duration = req.duration or 10.0
    exposure = req.exposure or 100

    try:
        rc = RemoteControl(HOST)
        phase, duration, exp_time = rc.start_video()
        sessions[req.session_id] = rc
        return StartResponse(
            session_id=req.session_id,
            duration=duration,
            exposure=exposure,
        )
    except Exception as e:
        # ensure no half-open socket remains
        rc.close()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/stop-recording")
def stop_recording(req: StopRecordingRequest):
    if req.session_id not in sessions:
        raise HTTPException(status_code=400, detail="Invalid session ID")

    rc = sessions.pop(req.session_id)
    try:
        rc.stop_video()
        original_path = rc.get_video(want_progress_bar=False)
    finally:
        rc.close()

    # build unique filename
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    base, _ = os.path.splitext(req.name)
    unique_name = f"{base}_{timestamp}.mp4"
    final_save_path = Path(req.save_path) / req.session_id
    final_save_path.mkdir(parents=True, exist_ok=True)
    final_path = final_save_path / unique_name
    shutil.move(original_path, str(final_path))

    return {"path": final_path}

# @app.delete("/delete_video/{filename}")
# def delete_video(filename: str):
#    file_path = os.path.join("/storage/emulated/0/DCIM/OpenCamera", filename)
#    if os.path.exists(file_path):
#        os.remove(file_path)
#        return {"status": "deleted", "file": filename}
#    else:
#        return JSONResponse(status_code=404, content={"message": "File not found"})

@app.post("/end-session")
async def end_session(req: EndSessionRequest):
    final_save_path = Path(req.save_path) / req.session_id
    print(f"[DEBUG] Final save path: {final_save_path}")
        
    # Join root path and session_id
    save_path = Path(os.path.join(req.save_path, req.session_id))
    
    print(f"Ending session for {req.session_id} with save path {save_path}")
    if not save_path.exists():
        raise HTTPException(status_code=400, detail=f"Save path not found: {save_path}")
    
    # Find all files under save_path recursively
    all_files = list(save_path.rglob("*.mp4"))
    if not all_files:
        return {"message": "No video files found."}
    print(f"Found {len(all_files)} video files in {save_path}")
    grouped = {}
    for f in all_files:
        # Assume filenames like: "subjectID_activity_2025-07-24_15-43-00.mp4"
        participant_id = f.stem.split("_")[0]
        grouped.setdefault(participant_id, []).append(f)

    # Create CSV
    csv_path =  Path(save_path) / "file_index.csv"
    with open(csv_path, mode="w", newline="") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(["participant_id", "file_path"])
        for pid, files in grouped.items():
            for file in files:
                writer.writerow([pid, str(file)])

    # Move files into folders by participant
    grouped_dir =  Path(save_path) / "grouped_by_participant"
    grouped_dir.mkdir(exist_ok=True)

    for pid, files in grouped.items():
        participant_folder = grouped_dir / pid
        participant_folder.mkdir(exist_ok=True)
        for file in files:
            dest = participant_folder / file.name
            if not dest.exists():  # avoid overwriting
                shutil.copy2(file, dest)

    return {"message": "Session ended. Files grouped and CSV created.", "csv_path": str(csv_path)}

@app.get("/list-videos")
def list_videos(
    session_id: str = Query(...),
    save_path: str = Query(...)
):
    session_path = Path(save_path) / session_id
    if not session_path.exists() or not session_path.is_dir():
        raise HTTPException(status_code=404, detail=f"Session path not found: {session_path}")

    # List only .mp4 files (case-insensitive)
    video_names = [f.name for f in session_path.glob("*.mp4")]
    return {"videos": video_names}

@app.get("/videos")
def get_video(
    root_path: str = Query(...),
    session_id: str = Query(...),
    video_name: str = Query(...)
):
    video_path = Path(root_path) / session_id / video_name
    try:
        video_path = video_path.resolve(strict=True)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Video not found: {video_path}")

    if not video_path.is_file():
        raise HTTPException(status_code=400, detail=f"Requested path is not a file: {video_path}")

    return FileResponse(path=video_path, media_type="video/mp4")

# --- NEW: Endpoint to capture a calibration video ---
@app.post("/capture-calibration-video")
async def capture_calibration_video(request: CaptureRequest):
    """
    Captures a video from the default camera for a specified duration.
    """
    video_filename = f"{request.study_id}_{request.session_id}_calib.avi"
    video_file_path = VIDEO_SAVE_PATH / video_filename

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise HTTPException(status_code=500, detail="Failed to open camera.")

    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    fourcc = cv2.VideoWriter_fourcc(*'XVID')
    out = cv2.VideoWriter(str(video_file_path), fourcc, fps, (frame_width, frame_height))

    start_time = time.time()
    print(f"Starting video capture for {request.duration} seconds...")
    while (time.time() - start_time) < request.duration:
        ret, frame = cap.read()
        if not ret:
            break
        
        out.write(frame)
        cv2.imshow('Calibration Video Capture', frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    out.release()
    cv2.destroyAllWindows()
    print(f"Video capture finished. Saved to {video_file_path}")

    return {"file_path": str(video_file_path), "message": "Calibration video captured successfully."}

# --- NEW: Endpoint to process the calibration video ---
@app.post("/process-calibration-video")
async def process_calibration_video(request: ProcessRequest):
    """
    Processes a previously captured video to perform camera calibration.
    """
    video_filename = f"{request.study_id}_{request.session_id}_calib.avi"
    video_file_path = VIDEO_SAVE_PATH / video_filename

    if not video_file_path.exists():
        raise HTTPException(status_code=404, detail="Calibration video not found. Please capture it first.")

    print(f"Starting calibration for video: {video_file_path}")

    try:
        camera_matrix, dist_coeffs, reprojection_error = perform_calibration(str(video_file_path))

        output_dir = CALIBRATION_PARAMS_PATH / request.study_id / request.session_id
        os.makedirs(output_dir, exist_ok=True)
        
        camera_matrix_path = output_dir / 'camera_matrix.npy'
        dist_coeffs_path = output_dir / 'dist_coeffs.npy'
        
        np.save(str(camera_matrix_path), camera_matrix)
        np.save(str(dist_coeffs_path), dist_coeffs)

        return {
            "message": "Calibration successful.",
            "reprojection_error": float(reprojection_error),
            "camera_matrix_path": str(camera_matrix_path),
            "dist_coeffs_path": str(dist_coeffs_path)
        }
    except Exception as e:
        print(f"Calibration failed: {e}")
        raise HTTPException(status_code=500, detail=f"Calibration failed: {str(e)}")

# --- NEW: Core Calibration Logic (a separate helper function) ---
def perform_calibration(video_path: str):
    """
    This function contains the core logic to process the video and calibrate the camera.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Failed to open video file: {video_path}")

    all_charuco_corners = []
    all_charuco_ids = []
    image_size = None
    frame_count = 0

    print("Processing video frames...")
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        
        frame_count += 1
        if frame_count % 5 != 0:
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if image_size is None:
            image_size = gray.shape[::-1]

        marker_corners, marker_ids, _ = charuco_detector.detectMarkers(gray)

        if marker_ids is not None and len(marker_ids) > 0:
            charuco_corners, charuco_ids = charuco_detector.interpolateCornersCharuco(
                marker_corners, marker_ids, gray
            )
            if charuco_ids is not None and len(charuco_ids) >= 4:
                all_charuco_corners.append(charuco_corners)
                all_charuco_ids.append(charuco_ids)

    cap.release()
    cv2.destroyAllWindows()

    if len(all_charuco_corners) < 5:
        raise RuntimeError(f"Not enough successful board detections ({len(all_charuco_corners)}). Need at least 5 to calibrate.")

    print(f"Calibration using {len(all_charuco_corners)} successfully detected board views.")
    ret, camera_matrix, dist_coeffs, _, _ = aruco.calibrateCameraCharuco(
        all_charuco_corners, all_charuco_ids, board, image_size, None, None
    )

    if ret > 1.0:
        print(f"Warning: High reprojection error of {ret}. Calibration may be inaccurate.")
    
    return camera_matrix, dist_coeffs, ret
    
# @app.get("/video_feed") This works for recordings from the webcam,
# not the smart phone but it is a good first step
# def video_feed():
#    def generate():
#        cap = cv2.VideoCapture(0)  # Or path to smartphone stream
#        while True:
#            success, frame = cap.read()
#            if not success:
#                break
#            _, buffer = cv2.imencode('.jpg', frame)
#            frame_bytes = buffer.tobytes()
#            yield (b'--frame\r\n'
#                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

#    return StreamingResponse(generate(), media_type='multipart/x-mixed-replace; boundary=frame')