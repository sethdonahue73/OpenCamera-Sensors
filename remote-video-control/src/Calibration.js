import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Calibration() {
    // State variables for session details loaded from localStorage
    const [studyId, setStudyId] = useState("");
    const [sessionId, setSessionId] = useState("");
    const [smartphoneIp, setSmartphoneIp] = useState("");
    const [baseSavePath, setBaseSavePath] = useState("");

    // State for the full derived save path
    const [fullSavePath, setFullSavePath] = useState("");

    // Calibration parameters
    const [boardRows, setBoardRows] = useState(7);
    const [boardCols, setBoardCols] = useState(5);
    const [squareSize, setSquareSize] = useState(0.025); // in meters, e.g., 2.5 cm
    const [duration, setDuration] = useState(5); // Default video duration in seconds

    // UI state
    const [isCalibrating, setIsCalibrating] = useState(false);
    const [calibrationMessage, setCalibrationMessage] = useState("");

    // Use a useEffect hook to load session details and derive the full path when the component mounts
    useEffect(() => {
        const storedStudyId = localStorage.getItem('studyId');
        const storedSessionId = localStorage.getItem('sessionId');
        const storedSmartphoneIp = localStorage.getItem('smartphoneIp');
        const storedBaseSavePath = localStorage.getItem('baseSavePath');

        if (storedStudyId) setStudyId(storedStudyId);
        if (storedSessionId) setSessionId(storedSessionId);
        if (storedSmartphoneIp) setSmartphoneIp(storedSmartphoneIp);
        if (storedBaseSavePath) setBaseSavePath(storedBaseSavePath);

        // Derive the full save path from the stored values
        if (storedStudyId && storedSessionId && storedBaseSavePath) {
            const pathSeparator = storedBaseSavePath.endsWith('/') || storedBaseSavePath.endsWith('\\') ? '' : '/';
            setFullSavePath(`${storedBaseSavePath}${pathSeparator}${storedStudyId}/${storedSessionId}`);
        } else {
            setFullSavePath("Not set");
        }

        // Clear the message when the component loads
        setCalibrationMessage("");
    }, []);

    // Function to perform the entire calibration workflow
    const performFullCalibration = async () => {
        if (!studyId || !sessionId) {
            setCalibrationMessage("Error: Session details are missing. Please go back to Session Initialization.");
            return;
        }

        setIsCalibrating(true);
        setCalibrationMessage("Starting smartphone video capture and calibration processing...");

        try {
            const response = await axios.post("http://localhost:8000/capture-and-process-smartphone-calibration", {}, {
                params: {
                    study_id: studyId,
                    session_id: sessionId,
                    smartphone_ip: smartphoneIp,
                    duration: duration,
                    board_rows: boardRows,
                    board_cols: boardCols,
                    square_size: squareSize,
                    save_path: baseSavePath // Pass the baseSavePath to the backend
                }
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
            
            {/* Display the loaded session details */}
            <div style={{ background: '#f0f0f0', padding: '1rem', marginBottom: '2rem' }}>
                <h3>Current Session Details</h3>
                <p><strong>Study ID:</strong> {studyId || "Not set"}</p>
                <p><strong>Session ID:</strong> {sessionId || "Not set"}</p>
                <p><strong>Smartphone IP:</strong> {smartphoneIp || "Not set"}</p>
                <p><strong>Full Save Path:</strong> <code>{fullSavePath}</code></p>
            </div>

            <h3 style={{ marginTop: "2.5rem" }}>Calibration Parameters</h3>
            <div style={{ marginBottom: "1rem", display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div>
                    <label htmlFor="board-rows">Inner Corners (Rows):</label>
                    <input
                        type="number"
                        id="board-rows"
                        value={boardRows}
                        onChange={(e) => setBoardRows(parseInt(e.target.value))}
                        style={{ marginLeft: "0.5rem", padding: "8px", width: "80px" }}
                        min="1"
                    />
                </div>
                <div>
                    <label htmlFor="board-cols">Inner Corners (Cols):</label>
                    <input
                        type="number"
                        id="board-cols"
                        value={boardCols}
                        onChange={(e) => setBoardCols(parseInt(e.target.value))}
                        style={{ marginLeft: "0.5rem", padding: "8px", width: "80px" }}
                        min="1"
                    />
                </div>
                <div>
                    <label htmlFor="square-size">Square Size (m):</label>
                    <input
                        type="number"
                        id="square-size"
                        value={squareSize}
                        onChange={(e) => setSquareSize(parseFloat(e.target.value))}
                        style={{ marginLeft: "0.5rem", padding: "8px", width: "80px" }}
                        step="0.001"
                        min="0.001"
                    />
                </div>
                <div>
                    <label htmlFor="duration">Video Duration (s):</label>
                    <input
                        type="number"
                        id="duration"
                        value={duration}
                        onChange={(e) => setDuration(parseInt(e.target.value))}
                        style={{ marginLeft: "0.5rem", padding: "8px", width: "80px" }}
                        min="1"
                    />
                </div>
            </div>

            <h3 style={{ marginTop: "2.5rem" }}>Start Full Calibration Workflow</h3>
            <button
                onClick={performFullCalibration}
                disabled={isCalibrating || !studyId || !sessionId}
                style={{ padding: "10px 20px", fontSize: "1rem" }}
            >
                {isCalibrating ? (
                    "Calibrating..."
                ) : (
                    "Start Full Calibration"
                )}
            </button>
            {calibrationMessage && <p style={{ marginTop: "1rem", color: isCalibrating ? 'orange' : (calibrationMessage.includes("Error") ? 'red' : 'green') }}>{calibrationMessage}</p>}

            <p style={{ marginTop: "2rem", fontStyle: "italic" }}>
                *This will capture a video from the smartphone and process it for camera calibration in a single step.
            </p>
        </div>
    );
}

export default Calibration;
