from fastapi import FastAPI, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from src.RemoteControl import RemoteControl
import os, time
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI

app = FastAPI()
HOST = '192.168.4.245'
remote = None
video_path = ""

class FileName(BaseModel):
    name: str
    save_path: str

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    
    # Provide the required argument here
    original_path = remote.get_video(want_progress_bar=True)
    
    custom_filename = file.name if file.name.endswith(".mp4") else file.name + ".mp4"
    full_save_path = os.path.join(file.save_path, custom_filename)
    os.rename(original_path, full_save_path)
    
    remote.close()
    video_path = full_save_path

    return {"path": full_save_path}


@app.get("/play-video")
def play_video():
    return FileResponse(video_path, media_type="video/mp4")

@app.post("/run-pose-estimation")
def run_pose_estimation():
    import cv2
    import mediapipe as mp

    cap = cv2.VideoCapture(video_path)
    pose = mp.solutions.pose.Pose()
    mp_drawing = mp.solutions.drawing_utils

    out_path = video_path.replace(".mp4", "_pose.mp4")
    width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)

    out = cv2.VideoWriter(out_path, cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height))

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
    return {"pose_video_path": out_path}
