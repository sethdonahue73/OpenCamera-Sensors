import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [filename, setFilename] = useState("recorded_video.mp4");
  const [savePath, setSavePath] = useState("c:/Videos/Test Video Data");

  const startRecording = async () => {
    const res = await axios.post("http://localhost:8000/start-recording");
    alert("Recording started: " + JSON.stringify(res.data));
  };

  const stopRecording = async () => {
    const res = await axios.post("http://localhost:8000/stop-recording", {
      name: filename,
      save_path: savePath
    });
    alert("Video saved: " + res.data.path);
  };

  const runPoseEstimation = async () => {
    const res = await axios.post("http://localhost:8000/run-pose-estimation");
    alert("Pose estimation done: " + res.data.pose_video_path);
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Remote Video Control</h2>
      <input value={filename} onChange={(e) => setFilename(e.target.value)} placeholder="Filename" />
      <input value={savePath} onChange={(e) => setSavePath(e.target.value)} placeholder="Save path" />
      <div style={{ marginTop: "1rem" }}>
        <button onClick={startRecording}>Start Recording</button>
        <button onClick={stopRecording}>Stop Recording</button>
        <button onClick={() => window.open("http://localhost:8000/play-video")}>Play Video</button>
        <button onClick={runPoseEstimation}>Run Pose Estimation</button>
      </div>
    </div>
  );
}

export default App;
