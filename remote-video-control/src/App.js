import React, { useState } from "react";
import axios from 'axios';

function App() {
  const [filename, setFilename] = useState("recorded_video.mp4");
  const [savePath, setSavePath] = useState("c:/Videos/Test Video Data");
  const [sessionId, setSessionId] = useState(null);

  // const startRecording = async () => {
  //   console.log("Start recording button clicked"); // <-- add this
  //   try {
  //     const res = await axios.post("http://localhost:8000/start-recording");
  //     console.log("Response:", res.data); // <-- add this
  //     alert("Recording started.");
  //   } catch (err) {
  //     console.error("Failed to start recording:", err); // <-- catch errors
  //     alert("Failed to start recording.");
  //   }
  // };

  // const stopRecording = async () => {
  //   try {
  //     const res = await axios.post("http://localhost:8000/stop-recording", {
  //       name: filename,
  //       save_path: savePath
  //     });
  //     alert("Video saved to: " + res.data.path);
  //   } catch (err) {
  //     console.error("Failed to stop recording:", err);
  //     alert("Error stopping recording.");
  //   }
  // };
    
  const startRecording = async () => {
    try {
      const res = await axios.post("http://localhost:8000/start-recording", {
        name: filename,
        save_path: savePath
      });
      setSessionId(res.data.session_id);
      // alert("Recording started!");
    } catch (err) {
      console.error("Failed to start recording:", err);
      alert("Error starting recording.");
    }
  };

  const stopRecording = async () => {
    try {
      if (!sessionId) {
        alert("No active session!");
        return;
      }
      const res = await axios.post("http://localhost:8000/stop-recording", {
        session_id: sessionId,
        name: filename,
        save_path: savePath
      });
      alert("Video saved to: " + res.data.path);
      setSessionId(null); // clear after stopping
    } catch (err) {
      console.error("Failed to stop recording:", err);
      alert("Error stopping recording.");
    }
  };

  return (
  <div style={{ padding: "2rem" }}>
    <h2>Video Recorder</h2>

    <div>
      <label>Session ID: </label>
      <input
        value={sessionId}
        onChange={(e) => setSessionId(e.target.value)}
      />
    </div>

    <div style={{ marginTop: "0.5rem" }}>
      <label>Filename: </label>
      <input
        value={filename}
        onChange={(e) => setFilename(e.target.value)}
      />
    </div>

    <div style={{ marginTop: "0.5rem" }}>
      <label>Save Path: </label>
      <input
        value={savePath}
        onChange={(e) => setSavePath(e.target.value)}
      />
    </div>

    <div style={{ marginTop: "1rem" }}>
      <button onClick={startRecording}>Start</button>
      <button onClick={stopRecording} style={{ marginLeft: "1rem" }} disabled={!sessionId}>
        Stop
      </button>
    </div>
  </div>
  );
}

export default App;
