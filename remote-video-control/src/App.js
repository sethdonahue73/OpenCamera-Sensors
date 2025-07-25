import React, { useState } from "react";
import axios from 'axios';

function App() {
  const [filename, setFilename] = useState("ID_activity");
  const [savePath, setSavePath] = useState("c:/Videos/Test Video Data");
  const [sessionId, setSessionId] = useState("project_name_and_date");
  // const [host, setHost] = useState(null);


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

  const endSession = async () => {
  try {
    const res = await axios.post("http://localhost:8000/end-session", {
      save_path: savePath,
      session_id: sessionId
    });
    alert(res.data.message + "\nCSV: " + res.data.csv_path);
  } catch (err) {
    console.error("Failed to end session:", err);
    alert("Error ending session.");
  }
};
    
  const startRecording = async () => {
    try {
      const res = await axios.post("http://localhost:8000/start-recording", {
        name: filename,
        session_id: sessionId,
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

      // Optionally extract the filename from the saved path if needed
      // const extractedFilename = res.data.path.split("\\").pop(); // for Windows paths
      // const extractedFilename = res.data.path.split("/").pop(); // for UNIX-like

      // Automatically delete the video
      // await deleteVideo(extractedFilename);
      // setSessionId(null); // clear after stopping
    } catch (err) {
      console.error("Failed to stop recording:", err);
      alert("Error stopping recording.");
    }
  };

  
// const deleteVideo = async (filename) => {
//   try {
//     const res = await fetch(`http://${host}:8000/delete_video/${filename}`, {
//       method: "DELETE",
//     });
//     const data = await res.json();
//     alert(`Deleted video: ${data.file}`);
//   } catch (err) {
//     console.error("Failed to delete video", err);
//   }
// };

  return (
  <div style={{ padding: "2rem" }}>
    <h2>Video Recorder</h2>
    <div style={{ marginTop: "0.5rem" }}>
      <label>Filename: </label>
      <input
        value={filename}
        onChange={(e) => setFilename(e.target.value)}
      />
    </div>

    <div>
      <label>Session ID: </label>
      <input
        value={sessionId}
        onChange={(e) => setSessionId(e.target.value)}
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
      {/* <button onClick={() => deleteVideo(filename)} style={{ marginLeft: "1rem" }}>
        Delete Video
      </button> */}
      <button onClick={endSession} style={{ marginLeft: "1rem" }}>
        End Session
      </button>
    </div>
  </div>
  );
}

export default App;
