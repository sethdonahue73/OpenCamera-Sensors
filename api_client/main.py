from fastapi import FastAPI, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles
from src.RemoteControl import RemoteControl
import os, time, datetime, shutil
from fastapi.middleware.cors import CORSMiddleware
import glob


app = FastAPI()
HOST = '192.168.4.245'
remote = None
video_path = ""

class FileName(BaseModel):
    name: str
    save_path: str

class VideoPathRequest(BaseModel):
    video_path: str


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve videos from the ./videos folder
app.mount("/videos", StaticFiles(directory=r"C:\Users\sethy\Videos\Test Video Data"), name="videos")


@app.post("/start-recording")
def start_recording():
    global remote
    remote = RemoteControl(HOST)
    phase, duration, exp_time = remote.start_video()
    return {"status": "recording", "duration": duration, "exposure": exp_time}

# @app.post("/stop-recording")
# def stop_recording(file: FileName):
#     global remote, video_path
#     remote.stop_video()
#     original_path = remote.get_video(want_progress_bar = True)
#     custom_filename = file.name if file.name.endswith(".mp4") else file.name + ".mp4"
#     full_save_path = os.path.join(file.save_path, custom_filename)
#     os.rename(original_path, full_save_path)
#     remote.close()
#     video_path = full_save_path
#     return {"path": full_save_path}

@app.post("/stop-recording")
def stop_recording(file: FileName):
    global remote, video_path

    remote.stop_video()
    original_path = remote.get_video(want_progress_bar=True)

    # Create timestamped session folder
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    session_folder = os.path.join("videos", timestamp)
    os.makedirs(session_folder, exist_ok=True)

    # Determine filename iteration (recording_0001.mp4, _0002, etc.)
    base_name = "recording"
    extension = ".mp4"
    counter = 1
    while True:
        new_filename = f"{base_name}_{counter:04d}{extension}"
        full_path = os.path.join(session_folder, new_filename)
        if not os.path.exists(full_path):
            break
        counter += 1

    # Move or rename the video
    shutil.move(original_path, full_path)

    remote.close()
    video_path = full_path
    return {"path": full_path}


@app.get("/play-video")
def play_video():
    return FileResponse(video_path, media_type="video/mp4")

@app.get("/play-combined")
def play_combined():
    # Example path — update to match your combined video output
    combined_video_path = "videos/last_pose_overlay.mp4"
    if os.path.exists(combined_video_path):
        return FileResponse(combined_video_path, media_type="video/mp4")
    return {"error": "Combined video not found"}

@app.get("/list-videos")
def list_videos():
    files = glob.glob("videos/**/*.mp4", recursive=True)
    files = [f.replace("\\", "/") for f in files]  # Normalize paths for frontend
    return {"videos": files}




@app.post("/run-pose-estimation")
def run_pose_estimation(request: VideoPathRequest):
    import cv2, mediapipe as mp, os

    video_path = request.video_path
    cap = cv2.VideoCapture(video_path)
    pose = mp.solutions.pose.Pose()
    mp_drawing = mp.solutions.drawing_utils

    os.makedirs("videos", exist_ok=True)
    output_path = "videos/last_pose_overlay.mp4"

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)

    out = cv2.VideoWriter(output_path, cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height))

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        results = pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        if results.pose_landmarks:
            mp_drawing.draw_landmarks(frame, results.pose_landmarks, mp.solutions.pose.POSE_CONNECTIONS)
        out.write(frame)

    cap.release()
    out.release()

    return {"pose_video_path": output_path}
