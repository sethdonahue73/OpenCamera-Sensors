import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Helper function to generate a timestamped session suffix
const generateTimestampSuffix = () => {
    const now = new Date();
    const datePart = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, '0') + "-" + String(now.getDate()).padStart(2, '0');
    const timePart = String(now.getHours()).padStart(2, '0') + "-" + String(now.getMinutes()).padStart(2, '0') + "-" + String(now.getSeconds()).padStart(2, '0');
    return `${datePart}_${timePart}`;
};

function SessionInitialization() {
    const navigate = useNavigate();

    // State variables for user inputs
    const [studyId, setStudyId] = useState(localStorage.getItem('studyId') || "");
    const [sessionName, setSessionName] = useState(localStorage.getItem('sessionName') || "");
    const [videoNameSuffix, setVideoNameSuffix] = useState(localStorage.getItem('videoNameSuffix') || "");
    const [smartphoneIp, setSmartphoneIp] = useState(localStorage.getItem('smartphoneIp') || "192.168.4.245");
    const [baseSavePath, setBaseSavePath] = useState(localStorage.getItem('baseSavePath') || "data");
    
    // The unique sessionId and full path are now derived
    const [sessionId, setSessionId] = useState("");
    const [location, setLocation] = useState("");

    // UI state
    const [message, setMessage] = useState("");
    const [isNavigating, setIsNavigating] = useState(false);
    
    // A separate state for the initial timestamp, which doesn't change after load
    const [timestampSuffix, setTimestampSuffix] = useState(generateTimestampSuffix());


    // Use a useEffect hook to update the derived sessionId and save path
    useEffect(() => {
        // Construct the full sessionId
        if (sessionName) {
            setSessionId(`${sessionName}_${timestampSuffix}`);
        } else {
            // Fallback if no session name is provided
            setSessionId(timestampSuffix);
        }

        // Construct the full save path
        if (studyId && sessionId) {
            const pathSeparator = baseSavePath.endsWith('/') || baseSavePath.endsWith('\\') ? '' : '/';
            setLocation(`${baseSavePath}${pathSeparator}${studyId}/${sessionId}`);
        } else {
            setLocation(baseSavePath);
        }

        // Save values to localStorage for persistence
        localStorage.setItem('studyId', studyId);
        localStorage.setItem('sessionName', sessionName);
        localStorage.setItem('videoNameSuffix', videoNameSuffix);
        localStorage.setItem('smartphoneIp', smartphoneIp);
        localStorage.setItem('baseSavePath', baseSavePath);
        localStorage.setItem('sessionId', sessionId); // Save the combined ID for the next page
    }, [studyId, sessionName, videoNameSuffix, smartphoneIp, baseSavePath, sessionId, timestampSuffix]);

    const handleGoToCalibration = () => {
        if (!studyId || !sessionName) {
            setMessage("Error: Please enter both a Study ID and a Session Name.");
            return;
        }
        
        setIsNavigating(true);
        setMessage("Details saved. Navigating to Calibration...");
        
        setTimeout(() => {
            navigate('/calibration');
        }, 1500);
    };

    return (
        <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
            <h2>Session Initialization</h2>
            <p>Enter the details to start a new recording session on the smartphone.</p>

            <h3 style={{ marginTop: "2rem" }}>Session Details</h3>
            <div style={{ marginBottom: "1rem" }}>
                <label htmlFor="study-id">Study ID:</label>
                <input
                    type="text"
                    id="study-id"
                    value={studyId}
                    onChange={(e) => setStudyId(e.target.value)}
                    style={{ marginLeft: "0.5rem", padding: "8px" }}
                    placeholder="e.g., Study_ABC"
                />
            </div>
            <div style={{ marginBottom: "1rem" }}>
                <label htmlFor="session-name">Session Name:</label>
                <input
                    type="text"
                    id="session-name"
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    style={{ marginLeft: "0.5rem", padding: "8px" }}
                    placeholder="e.g., session_1"
                />
            </div>
            <div style={{ marginBottom: "1rem" }}>
                <label htmlFor="video-name-suffix">Video Name Suffix:</label>
                <input
                    type="text"
                    id="video-name-suffix"
                    value={videoNameSuffix}
                    onChange={(e) => setVideoNameSuffix(e.target.value)}
                    style={{ marginLeft: "0.5rem", padding: "8px" }}
                    placeholder="e.g., baseline_trial"
                />
            </div>
            <div style={{ marginBottom: "1rem" }}>
                <label htmlFor="smartphone-ip">Smartphone IP:</label>
                <input
                    type="text"
                    id="smartphone-ip"
                    value={smartphoneIp}
                    onChange={(e) => setSmartphoneIp(e.target.value)}
                    style={{ marginLeft: "0.5rem", padding: "8px" }}
                    placeholder="e.g., 192.168.1.100"
                />
            </div>
            <div style={{ marginBottom: "1rem" }}>
                <label htmlFor="base-save-path">Base Save Path:</label>
                <input
                    type="text"
                    id="base-save-path"
                    value={baseSavePath}
                    onChange={(e) => setBaseSavePath(e.target.value)}
                    style={{ marginLeft: "0.5rem", padding: "8px" }}
                    placeholder="e.g., C:\videos"
                />
            </div>

            <h3 style={{ marginTop: "2.5rem" }}>Next Step</h3>
            <div style={{ marginBottom: "1rem", border: '1px solid #ccc', padding: '1rem' }}>
                <p><strong>Derived Session ID:</strong> <code>{sessionId || "Not set"}</code></p>
                <p><strong>Full Save Path:</strong> <code>{location || "Not set"}</code></p>
            </div>
            <button
                onClick={handleGoToCalibration}
                disabled={isNavigating || !studyId || !sessionName}
                style={{ padding: "10px 20px", fontSize: "1rem" }}
            >
                {isNavigating ? "Saving..." : "Go to Calibration"}
            </button>
            {message && <p style={{ marginTop: "1rem", color: isNavigating ? 'orange' : 'red' }}>{message}</p>}
        </div>
    );
}

export default SessionInitialization;