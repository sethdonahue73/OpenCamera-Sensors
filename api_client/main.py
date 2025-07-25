from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from src.RemoteControl import RemoteControl
from typing import Optional

import os
import shutil
from datetime import datetime
import uuid
from pathlib import Path
import csv
from fastapi.responses import JSONResponse

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # <- allow all dev origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

HOST = os.getenv("SMARTPHONE_HOST", "192.168.4.240")

# In‐memory store for active sessions
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

# @app.get("/config")
# def get_config():
#     return {"host": HOST}

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
    # save_path = req.save_path.rstrip("\\/")
    # final_save_path = os.path.join(save_path, req.session_id)
    # os.makedirs(final_save_path, exist_ok=True)
    # final_path = os.path.join(final_save_path, unique_name)
    final_save_path = Path(req.save_path) / req.session_id
    final_save_path.mkdir(parents=True, exist_ok=True)
    # print(f"Moving video to {final_path}")
    # shutil.move(original_path, final_path)
    final_path = final_save_path / unique_name
    shutil.move(original_path, str(final_path))

    return {"path": final_path}

# @app.delete("/delete_video/{filename}")
# def delete_video(filename: str):
#     file_path = os.path.join("/storage/emulated/0/DCIM/OpenCamera", filename)
#     if os.path.exists(file_path):
#         os.remove(file_path)
#         return {"status": "deleted", "file": filename}
#     else:
#         return JSONResponse(status_code=404, content={"message": "File not found"})

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