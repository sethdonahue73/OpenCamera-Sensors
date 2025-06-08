from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from src.RemoteControl import RemoteControl

import os
import shutil
from datetime import datetime
import uuid

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # <- allow all dev origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

HOST = os.getenv("SMARTPHONE_HOST", "192.168.4.245")

# In‐memory store for active sessions
sessions: dict[str, RemoteControl] = {}


class StartResponse(BaseModel):
    session_id: str
    duration: float
    exposure: int


class StopRecordingRequest(BaseModel):
    session_id: str
    name: str
    save_path: str


@app.post("/start-recording", response_model=StartResponse)
def start_recording():
    session_id = str(uuid.uuid4())
    try:
        rc = RemoteControl(HOST)
        phase, duration, exp_time = rc.start_video()
        sessions[session_id] = rc
        return StartResponse(
            session_id=session_id,
            duration=duration,
            exposure=exp_time
        )
    except Exception as e:
        # ensure no half‐open socket remains
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
    os.makedirs(req.save_path, exist_ok=True)
    final_path = os.path.join(req.save_path, unique_name)
    shutil.move(original_path, final_path)

    return {"path": final_path}
