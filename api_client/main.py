from fastapi import FastAPI, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from src.RemoteControl import RemoteControl
import os, time, glob
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import cv2

app = FastAPI()
HOST = '172.20.10.5' #'192.168.4.245'
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

    # Stop video capture
    remote.stop_video()

    # Retrieve downloaded video path (likely stored in ./api_client/)
    original_path = remote.get_video(want_progress_bar=True)

    # Ensure filename ends with .mp4
    custom_filename = file.name if file.name.endswith(".mp4") else file.name + ".mp4"

    # Resolve full save path
    full_save_dir = os.path.abspath(file.save_path)
    os.makedirs(full_save_dir, exist_ok=True)
    full_save_path = os.path.join(full_save_dir, custom_filename)

    # Rename/move the downloaded video to the final location
    print(f"Renaming: {original_path} -> {full_save_path}")
    os.rename(original_path, full_save_path)

    # Clean up and return
    remote.close()
    video_path = full_save_path

    return {"path": full_save_path}

# @app.post("/stop-recording")
# def stop_recording(file: FileName):
#     global remote, video_path
#     remote.stop_video()
    
#     # Provide the required argument here
#     original_path = remote.get_video(want_progress_bar=True)
    
#     custom_filename = file.name if file.name.endswith(".mp4") else file.name + ".mp4"
#     full_save_path = os.path.join(file.save_path, custom_filename)
#     os.rename(original_path, full_save_path)
    
#     remote.close()
#     video_path = full_save_path

#     return {"path": full_save_path}



@app.get("/play-video")
def play_video():
    return FileResponse(video_path, media_type="video/mp4")

# Utility to draw landmarks
def draw_landmarks_on_image(image, detection_result):
    pose_landmarks_list = detection_result.pose_landmarks
    annotated_image = image.copy()

    for landmarks in pose_landmarks_list:
        mp.solutions.drawing_utils.draw_landmarks(
            image=annotated_image,
            landmark_list=landmarks,
            connections=mp.solutions.pose.POSE_CONNECTIONS,
            landmark_drawing_spec=mp.solutions.drawing_utils.DrawingSpec(color=(0,255,0), thickness=2, circle_radius=2),
            connection_drawing_spec=mp.solutions.drawing_utils.DrawingSpec(color=(255,0,0), thickness=2))
    return annotated_image

# Route to process video
@app.post("/run-pose-estimation")
def run_pose_estimation(file: FileName):
    filename = file.filename
    save_path = file.save_path
    video_path = os.path.join(save_path, filename)

    if not os.path.exists(video_path):
        return {"error": f"Video file not found: {video_path}"}

    output_path = video_path.replace(".mp4", "_pose.mp4")
    model_path = os.path.abspath("cv_models/mediapipe/pose_landmarker_heavy.task")
    # Create the pose detector
    base_options = python.BaseOptions(model_asset_path=model_path)
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        output_segmentation_masks=False,
        running_mode=vision.RunningMode.VIDEO)
    detector = vision.PoseLandmarker.create_from_options(options)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {"error": f"Cannot open video: {video_path}"}

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)

    out = cv2.VideoWriter(output_path, cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height))

    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame)

        # Run detection with timestamp in ms
        detection_result = detector.detect_for_video(mp_image, frame_idx * int(1000 / fps))

        annotated_frame = draw_landmarks_on_image(frame, detection_result)
        out.write(annotated_frame)

        frame_idx += 1

    cap.release()
    out.release()
    return {"pose_video_path": output_path}