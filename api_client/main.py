import os
import shutil
import csv
import cv2
import numpy as np
import time
import pickle
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
# from src.RemoteControl import RemoteControl # Uncomment this if you are using a RemoteControl library

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# NOTE: Uncomment and configure your smartphone host if needed
# HOST = os.getenv("SMARTPHONE_HOST", "192.168.4.245")
sessions: dict[str, dict] = {} 

# --- Pydantic Models for Request Bodies ---
class StartRecordingRequest(BaseModel):
    name: str
    session_id: str
    save_path: str
    study_id: str

class StopRecordingRequest(BaseModel):
    name: str
    session_id: str
    save_path: str
    study_id: str

class EndSessionRequest(BaseModel):
    session_id: str
    notes: Optional[Dict] = None

class ParticipantRequest(BaseModel):
    sessionId: str
    studyId: str
    baseSavePath: str
    participantId: str
    height: float
    weight: float
    birthday: str
    sex: str

class StartRequest(BaseModel):
    session_id: str
    name: Optional[str] = None
    save_path: Optional[str] = None
    duration: Optional[float] = None
    exposure: Optional[int] = None
    smartphone_ip: Optional[str] = None

class StartResponse(BaseModel):
    session_id: str
    duration: float
    exposure: int

class CaptureRequest(BaseModel):
    study_id: str
    session_id: str
    duration: int = 5

class ProcessRequest(BaseModel):
    study_id: str
    session_id: str
    board_rows: int
    board_cols: int
    square_size: float

# --- Models for Saving Full Session State ---
class VideoRecord(BaseModel):
    name: str
    path: str
    timestamp: str

class CalibrationData(BaseModel):
    reprojection_error: float
    camera_matrix: list[list[float]]
    dist_coeffs: list[float]
    board_rows: int
    board_cols: int
    square_size: float

class SessionState(BaseModel):
    session_id: str
    study_id: str
    save_path: str
    start_time: datetime
    end_time: Optional[datetime] = None
    calibration_data: Optional[CalibrationData] = None
    videos: list[VideoRecord] = []
    notes: Optional[dict] = None

# --- Helper Functions ---
def get_participants_csv_path(base_save_path: str, study_id: str):
    full_study_path = Path(base_save_path) / study_id
    full_study_path.mkdir(parents=True, exist_ok=True)
    return full_study_path / "participants.csv"

def perform_chessboard_calibration(video_path: str, rows: int, cols: int, square_size: float):
    # This remains unchanged
    # ... (rest of the function)
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Failed to open video file: {video_path}")
    
    objp = np.zeros((rows * cols, 3), np.float32)
    objp[:, :2] = np.mgrid[0:cols, 0:rows].T.reshape(-1, 2)
    objp *= square_size
    
    obj_points = []
    img_points = []
    image_size = None
    frame_count = 0
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.001)

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
            
        ret, corners = cv2.findChessboardCorners(gray, (cols, rows), None)
        
        if ret:
            obj_points.append(objp)
            corners2 = cv2.cornerSubPix(gray, corners, (11, 11), (-1, -1), criteria)
            img_points.append(corners2)
            
    cap.release()
    cv2.destroyAllWindows()
    
    if len(obj_points) < 10:
        raise RuntimeError(f"Not enough successful chessboard detections ({len(obj_points)}). Need at least 10 to calibrate.")
        
    ret, camera_matrix, dist_coeffs, rvecs, tvecs = cv2.calibrateCamera(
        obj_points, img_points, image_size, None, None
    )

    if ret > 1.0:
        print(f"Warning: High reprojection error of {ret}. Calibration may be inaccurate.")

    return camera_matrix, dist_coeffs, ret


# =================================================================================
# API ENDPOINT FOR SAVING PARTICIPANT DATA
# =================================================================================
@app.post("/api/save-participant")
async def save_participant(request: ParticipantRequest):
    csv_path = get_participants_csv_path(request.baseSavePath, request.studyId)
    fieldnames = ['participant_id', 'session_id', 'height', 'weight', 'birthday', 'sex', 'timestamp']

    participant_data = {
        'participant_id': request.participantId,
        'session_id': request.sessionId,
        'height': request.height,
        'weight': request.weight,
        'birthday': request.birthday,
        'sex': request.sex,
        'timestamp': datetime.now().isoformat()
    }

    file_exists = os.path.isfile(csv_path)
    
    with open(csv_path, mode='a', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        writer.writerow(participant_data)
        
    return {"message": f"Participant {request.participantId} saved successfully.", "path": str(csv_path)}


# =================================================================================
# API ENDPOINT FOR GETTING EXISTING PARTICIPANTS
# =================================================================================
@app.get("/api/participants/list")
async def get_participant_list(study_id: str, base_save_path: str):
    try:
        csv_path = get_participants_csv_path(base_save_path, study_id)
        
        if not csv_path.exists():
            return {"participant_ids": []}

        participant_ids = []
        with open(csv_path, mode='r', newline='') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                if 'participant_id' in row:
                    participant_ids.append(row['participant_id'])
        
        return {"participant_ids": participant_ids}

    except Exception as e:
        print(f"Error reading participant list: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to read participant list: {e}")


# =================================================================================
# API ENDPOINT FOR STARTING A MAIN APP RECORDING
# =================================================================================
@app.post("/start-recording")
async def start_recording(request: StartRecordingRequest):
    print(f"Received start request: {request}")
    
    try:
        # Note: Your RemoteControl library needs to be uncommented for this to work
        # rc = RemoteControl(HOST)
        # phase, duration, exp_time = rc.start_video()
        
        sessions[request.session_id] = {
            "save_path": request.save_path,
            "study_id": request.study_id,
            "name": request.name,
            "is_recording": True,
            # "remote_control": rc, # Uncomment for real use
            "start_time": datetime.now(),
            "videos": [] # New: list to store video details
        }
        
        print(f"Starting main recording for session {request.session_id} with name {request.name}")
        return {"message": "Recording started.", "session_id": request.session_id}
        
    except Exception as e:
        # if 'rc' in locals(): rc.close() # Uncomment for real use
        raise HTTPException(status_code=500, detail=f"Failed to start recording on phone: {str(e)}")


# =================================================================================
# API ENDPOINT FOR STOPPING A MAIN APP RECORDING
# =================================================================================
@app.post("/stop-recording")
async def stop_recording(request: StopRecordingRequest):
    if request.session_id not in sessions or not sessions[request.session_id]["is_recording"]:
        raise HTTPException(status_code=400, detail="No active recording found for this session.")
        
    # Note: Your RemoteControl library needs to be uncommented for this to work
    # rc = sessions[request.session_id]["remote_control"]
    
    try:
        # rc.stop_video()
        # original_path = rc.get_video(want_progress_bar=False)

        # SIMULATED VIDEO DOWNLOAD FOR DEMO
        downloaded_filename = f"simulated_video_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4"
        original_path = Path(os.getcwd()) / downloaded_filename
        with open(original_path, "w") as f:
            f.write("This is a simulated video file.")

        print(f"Constructed path to downloaded video: {original_path}")
        
        start_time = sessions[request.session_id].get("start_time")
        if not start_time: start_time = datetime.now()
        timestamp_suffix = start_time.strftime("_%Y-%m-%d_%H-%M-%S")
    
    except Exception as e:
        # if 'rc' in locals(): rc.close() # Uncomment for real use
        raise HTTPException(status_code=500, detail=f"Failed to stop recording or download video: {str(e)}")

    finally:
        # if 'rc' in locals(): rc.close() # Uncomment for real use
        sessions[request.session_id]["is_recording"] = False

    try:
        cleaned_name = request.name.strip()
        participant_id = cleaned_name.split('_')[0].strip()
    except IndexError:
        raise HTTPException(status_code=400, detail="Invalid video name format. Expected 'participantID_activityName'.")

    full_session_path = Path(request.save_path) / request.study_id / request.session_id
    participant_dir = full_session_path / participant_id
    
    try:
        participant_dir.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Failed to create directory: {e}")

    final_video_name = f"{cleaned_name}{timestamp_suffix}.mp4"
    final_video_path = participant_dir / final_video_name
    
    try:
        shutil.move(original_path, final_video_path)
    except FileNotFoundError:
        print(f"FileNotFoundError: Could not find the file to move at {original_path}.")
        raise HTTPException(status_code=500, detail=f"Video file not found at {original_path}.")
    except Exception as e:
        print(f"Error moving file: {e}")
        if os.path.exists(original_path):
            os.remove(original_path)
        raise HTTPException(status_code=500, detail=f"Failed to move video file: {str(e)}")

    # New: Add the video to the session state
    video_record = VideoRecord(
        name=final_video_name,
        path=str(final_video_path),
        timestamp=datetime.now().isoformat()
    )
    sessions[request.session_id]["videos"].append(video_record.model_dump())

    trials_csv_path = participant_dir / "trials.csv"
    fieldnames = ['trial_name', 'timestamp']
    file_exists = os.path.isfile(trials_csv_path)
    
    with open(trials_csv_path, mode='a', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        writer.writerow({'trial_name': final_video_name, 'timestamp': datetime.now().isoformat()})
        
    print(f"Video saved to: {final_video_path}")
    print(f"Trial logged to: {trials_csv_path}")

    return {"message": "Recording stopped and video saved.", "path": str(final_video_path)}


# =================================================================================
# NEW: API ENDPOINT FOR ENDING AND SAVING A SESSION STATE
# =================================================================================
@app.post("/end-session")
async def end_session(request: EndSessionRequest):
    session_id = request.session_id
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found.")
    
    session_data = sessions[session_id]
    
    # Construct paths
    full_session_path = Path(session_data["save_path"]) / session_data["study_id"] / session_id
    summary_path = full_session_path / "session_summary.json"
    calibration_path = full_session_path / "calibration"
    
    # Load calibration data if it exists
    calibration_data = None
    calibration_files = list(calibration_path.glob("calibration_results_*.pkl"))
    if calibration_files:
        try:
            with open(calibration_files[0], 'rb') as f:
                cal_results = pickle.load(f)
                calibration_data = CalibrationData(
                    reprojection_error=cal_results.get("reprojection_error", 0.0),
                    camera_matrix=cal_results.get("camera_matrix", np.zeros((3,3))).tolist(),
                    dist_coeffs=cal_results.get("dist_coeffs", np.zeros(5)).tolist(),
                    board_rows=cal_results.get("board_rows", 0),
                    board_cols=cal_results.get("board_cols", 0),
                    square_size=cal_results.get("square_size", 0.0)
                )
        except Exception as e:
            print(f"Warning: Could not load calibration data for session {session_id}: {e}")

    # Build the full session state model
    session_state = SessionState(
        session_id=session_id,
        study_id=session_data["study_id"],
        save_path=session_data["save_path"],
        start_time=session_data["start_time"],
        end_time=datetime.now(),
        calibration_data=calibration_data,
        videos=[VideoRecord(**v) for v in session_data["videos"]],
        notes=request.notes
    )

    # Save the consolidated state to a JSON file
    try:
        with open(summary_path, 'w') as f:
            f.write(session_state.model_dump_json(indent=4))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save session summary: {e}")

    # Clean up the in-memory session data
    del sessions[session_id]

    return {"message": f"Session {session_id} ended and state saved successfully.", "summary_path": str(summary_path)}


# =================================================================================
# NEW: API ENDPOINT TO LOAD A SAVED SESSION STATE
# =================================================================================
@app.get("/get-session-state")
async def get_session_state(session_id: str, study_id: str, save_path: str):
    full_session_path = Path(save_path) / study_id / session_id
    summary_path = full_session_path / "session_summary.json"

    if not summary_path.exists():
        raise HTTPException(status_code=404, detail="Session summary file not found.")

    try:
        with open(summary_path, 'r') as f:
            session_data = json.load(f)
        return JSONResponse(content=session_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load session state: {e}")


# =================================================================================
# API ENDPOINT FOR LISTING VIDEOS
# =================================================================================
@app.get("/list-videos")
async def list_videos(session_id: str, save_path: str, study_id: str):
    try:
        full_session_path = Path(save_path) / study_id / session_id
        videos_list = []
        
        if full_session_path.exists() and full_session_path.is_dir():
            for participant_dir in full_session_path.iterdir():
                if participant_dir.is_dir():
                    for file in participant_dir.glob("*.mp4"):
                        videos_list.append(file.name)
        
        return {"videos": videos_list}

    except Exception as e:
        print(f"Error listing videos: {e}")
        raise HTTPException(status_code=500, detail="Failed to list videos.")


# =================================================================================
# API ENDPOINT FOR SERVING VIDEO FILES
# =================================================================================
@app.get("/videos")
async def get_video(root_path: str, session_id: str, study_id: str, video_name: str):
    try:
        participant_id = video_name.split('_')[0].strip()
        file_path = Path(root_path) / study_id / session_id / participant_id / video_name
        
        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(status_code=404, detail="Video file not found.")

        return FileResponse(file_path, media_type="video/mp4")
    except IndexError:
        raise HTTPException(status_code=400, detail="Invalid video name format.")
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Error serving video: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to serve video: {e}")


# =================================================================================
# API ENDPOINT FOR SMARTPHONE CALIBRATION
# =================================================================================
@app.post("/capture-and-process-smartphone-calibration")
async def capture_and_process_smartphone_calibration(
    study_id: str = Query(..., description="The unique identifier for the study."),
    session_id: str = Query(..., description="The unique identifier for the session."),
    smartphone_ip: str = Query(..., description="The IP address of the smartphone camera."),
    duration: int = Query(5, description="The duration of the video capture in seconds."),
    board_rows: int = Query(..., description="The number of inner chessboard corners in rows."),
    board_cols: int = Query(..., description="The number of inner chessboard corners in columns."),
    square_size: float = Query(..., description="The size of one square in meters."),
    save_path: str = Query("data", description="The root path where the session data will be saved.")
):
    try:
        base_path = Path(save_path) / study_id / session_id
        calibration_video_path = base_path / "calibration"
        os.makedirs(calibration_video_path, exist_ok=True)
        
        # Note: Your RemoteControl library needs to be uncommented for this to work
        # rc = RemoteControl(smartphone_ip)
        # rc.start_video()
        time.sleep(duration)
        # rc.stop_video()
        # original_path = rc.get_video(want_progress_bar=False)
        # rc.close()
        
        video_filename = f"calibration_video_{int(time.time())}.mp4"
        video_file_path = calibration_video_path / video_filename
        with open(video_file_path, "w") as f:
            f.write("Simulated video content for calibration.")
            
        camera_matrix, dist_coeffs, reprojection_error = perform_chessboard_calibration(
            str(video_file_path), board_rows, board_cols, square_size
        )
        
        calibration_outputs = {
            "reprojection_error": float(reprojection_error),
            "camera_matrix": camera_matrix,
            "dist_coeffs": dist_coeffs,
            "board_rows": board_rows,
            "board_cols": board_cols,
            "square_size": square_size
        }
        output_filename = f"calibration_results_{int(time.time())}.pkl"
        output_path = calibration_video_path / output_filename
        
        with open(output_path, 'wb') as f:
            pickle.dump(calibration_outputs, f)
            
        return {
            "message": "Calibration successful.",
            "reprojection_error": float(reprojection_error),
            "video_path": str(video_file_path),
            "calibration_results_path": str(output_path)
        }
        
    except Exception as e:
        print(f"Calibration failed: {e}")
        raise HTTPException(status_code=500, detail=f"Calibration failed: {str(e)}")

# The following endpoints from your provided code are kept as-is,
# assuming they are part of a different workflow.
# @app.get("/config")
# def get_config():
#     return {"host": HOST}

# @app.post("/start-smartphone-recording", response_model=StartResponse)
# def start_smartphone_recording(req: StartRequest):
#     # ... implementation from your original code
#     pass

# @app.post("/stop-smartphone-recording")
# def stop_smartphone_recording(req: StopRecordingRequest):
#     # ... implementation from your original code
#     pass

# @app.post("/end-session-with-grouping")
# async def end_session_with_grouping(req: EndSessionRequest):
#     # ... implementation from your original code
#     pass