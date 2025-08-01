import React, { useState } from 'react';
import axios from 'axios';

function Calibration() {
  const [studyId, setStudyId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [captureMessage, setCaptureMessage] = useState("");
  const [calibrationMessage, setCalibrationMessage] = useState("");

  const startCalibrationCapture = async () => {
    if (!studyId || !sessionId) {
      alert("Please enter both Study ID and Session ID.");
      return;
    }

    setIsCapturing(true);
    setCaptureMessage("Capturing 5-second calibration video...");
    setCalibrationMessage(""); // Clear previous calibration message

    try {
      const response = await axios.post("http://localhost:8000/capture-calibration-video", {
        study_id: studyId,
        session_id: sessionId,
        duration: 5 // 5 seconds
      });
      setCaptureMessage(`Calibration video saved: ${response.data.file_path}`);
    } catch (error) {
      console.error("Failed to capture calibration video:", error);
      setCaptureMessage("Failed to capture calibration video. Please check the backend.");
    } finally {
      setIsCapturing(false);
    }
  };

  const startCalibrationProcessing = async () => {
    if (!studyId || !sessionId) {
      alert("Please enter both Study ID and Session ID.");
      return;
    }

    setIsCalibrating(true);
    setCalibrationMessage("Processing video and calibrating camera...");

    try {
      const response = await axios.post("http://localhost:8000/process-calibration-video", {
        study_id: studyId,
        session_id: sessionId
      });
      setCalibrationMessage(
        `Calibration successful! Reprojection Error: ${response.data.reprojection_error.toFixed(4)}`
      );
      console.log("Calibration results:", response.data);
    } catch (error) {
      console.error("Failed to calibrate camera:", error);
      setCalibrationMessage(
        `Failed to calibrate camera. Error: ${error.response?.data?.detail || error.message}`
      );
    } finally {
      setIsCalibrating(false);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h2>Calibration</h2>
      <p>This page is dedicated to initiating and managing calibration procedures.</p>

      <h3 style={{ marginTop: "2rem" }}>Study and Session Initialization</h3>
      <div style={{ marginBottom: "1rem" }}>
        <label htmlFor="study-id">Study ID:</label>
        <input
          type="text"
          id="study-id"
          value={studyId}
          onChange={(e) => setStudyId(e.target.value)}
          style={{ marginLeft: "0.5rem", padding: "8px" }}
          placeholder="e.g., neuroscience_study_01"
        />
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <label htmlFor="session-id">Session ID:</label>
        <input
          type="text"
          id="session-id"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
          style={{ marginLeft: "0.5rem", padding: "8px" }}
          placeholder="e.g., participant_1_day_1"
        />
      </div>

      <h3 style={{ marginTop: "2.5rem" }}>Calibration Video Capture</h3>
      <button
        onClick={startCalibrationCapture}
        disabled={isCapturing || !studyId || !sessionId}
        style={{ padding: "10px 20px", fontSize: "1rem" }}
      >
        {isCapturing ? "Capturing..." : "Capture 5-sec Calibration Video"}
      </button>
      {captureMessage && <p style={{ marginTop: "1rem", color: isCapturing ? 'orange' : (captureMessage.includes("Failed") ? 'red' : 'green') }}>{captureMessage}</p>}

      <h3 style={{ marginTop: "2.5rem" }}>Process and Calibrate</h3>
      <button
        onClick={startCalibrationProcessing}
        disabled={isCalibrating || isCapturing || !studyId || !sessionId}
        style={{ padding: "10px 20px", fontSize: "1rem" }}
      >
        {isCalibrating ? "Calibrating..." : "Process Video & Calibrate"}
      </button>
      {calibrationMessage && <p style={{ marginTop: "1rem", color: isCalibrating ? 'orange' : (calibrationMessage.includes("Failed") ? 'red' : 'green') }}>{calibrationMessage}</p>}

      <p style={{ marginTop: "2rem", fontStyle: "italic" }}>
        *Please ensure a Charuco or ArUco board is visible to the camera during calibration.
      </p>
    </div>
  );
}

export default Calibration;