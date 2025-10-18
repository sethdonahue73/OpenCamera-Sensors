import React, { useEffect, useState } from "react";
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from "react-router-dom";
import About from "./About";
import Calibration from "./Calibration";
import Participants from "./Participants";
import SessionInitialization from './SessionInitialization';
import VideoSelector from "./VideoSelector"; // Assuming you've moved this to its own file
import TrialList from "./TrialList"; // Assuming you've moved this to its own file

// 💡 NEW COMPONENT: Main recording interface
const RecordingInterface = ({
  sessionId,
  studyId,
  baseSavePath,
  selectedParticipantId,
  setSelectedParticipantId,
  activityName,
  setActivityName,
  trials,
  setTrials,
  notes,
  setNotes,
  endSession,
  isLoadingParticipants,
  existingParticipantIds,
  startRecording,
  stopRecording,
  videoRefreshTrigger,
  setVideoRefreshTrigger,
}) => {
  const [isRecording, setIsRecording] = useState(false);

  const handleStart = async () => {
    const success = await startRecording();
    if (success) {
      setIsRecording(true);
    }
  };

  const handleStop = async () => {
    const success = await stopRecording();
    if (success) {
      setIsRecording(false);
    }
  };

  const currentSavePath = `${baseSavePath}/${studyId}/${sessionId}`;

  return (
    <>
      <p>Root Path: <code>{currentSavePath}</code></p>
      <div style={{ display: "flex", gap: "2rem", marginTop: "2rem" }}>
        <div style={{ flex: 1 }}>
          <h3>Controls</h3>
          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="participant-select">Participant:</label>
            <select
              id="participant-select"
              value={selectedParticipantId}
              onChange={(e) => setSelectedParticipantId(e.target.value)}
              style={{ marginLeft: "0.5rem", padding: "8px" }}
              disabled={isLoadingParticipants || isRecording}
            >
              <option value="">Select a participant</option>
              {isLoadingParticipants ? (
                <option disabled>Loading...</option>
              ) : existingParticipantIds.length > 0 ? (
                existingParticipantIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))
              ) : (
                <option disabled>No participants found</option>
              )}
            </select>
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="activity-name">Activity:</label>
            <input
              id="activity-name"
              value={activityName}
              onChange={(e) => setActivityName(e.target.value)}
              placeholder="e.g., jump_test"
              style={{ marginLeft: "0.5rem", padding: "8px" }}
              disabled={isRecording}
            />
          </div>
          <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
            <button
              onClick={handleStart}
              style={{ padding: "1rem 2rem", fontSize: "1.2rem", cursor: "pointer", backgroundColor: isRecording ? "#ccc" : "green", color: "white" }}
              disabled={!selectedParticipantId || !activityName || isRecording}
            >
              Start Recording
            </button>
            <button
              onClick={handleStop}
              style={{ padding: "1rem 2rem", fontSize: "1.2rem", cursor: "pointer", backgroundColor: !isRecording ? "#ccc" : "red", color: "white" }}
              disabled={!isRecording}
            >
              Stop Recording
            </button>
          </div>
          <button
            onClick={endSession}
            style={{ marginTop: "1rem", padding: "0.5rem 1rem", cursor: "pointer" }}
            disabled={isRecording}
          >
            End Session
          </button>
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <h3>Video Feed</h3>
          <VideoSelector sessionId={sessionId} savePath={baseSavePath} studyId={studyId} refreshTrigger={videoRefreshTrigger} />
        </div>
      </div>
      <TrialList sessionId={sessionId} trials={trials} notes={notes} setNotes={setNotes} />
    </>
  );
};

const Home = () => {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState("");
  const [studyId, setStudyId] = useState("");
  const [baseSavePath, setBaseSavePath] = useState("");
  const [activityName, setActivityName] = useState("");
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [trials, setTrials] = useState([]);
  const [notes, setNotes] = useState({});
  const [existingParticipantIds, setExistingParticipantIds] = useState([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);
  const [videoRefreshTrigger, setVideoRefreshTrigger] = useState(0);

  useEffect(() => {
    const storedSessionId = localStorage.getItem('sessionId');
    const storedStudyId = localStorage.getItem('studyId');
    const storedBaseSavePath = localStorage.getItem('baseSavePath');

    setSessionId(storedSessionId || "");
    setStudyId(storedStudyId || "");
    setBaseSavePath(storedBaseSavePath || "");

    const fetchParticipants = async () => {
      if (storedStudyId && storedBaseSavePath) {
        setIsLoadingParticipants(true);
        try {
          const response = await axios.get(`http://localhost:8000/api/participants/list`, {
            params: {
              study_id: storedStudyId,
              base_save_path: storedBaseSavePath,
            },
          });
          setExistingParticipantIds(response.data.participant_ids);
        } catch (error) {
          console.error("Failed to fetch participant list:", error);
          setExistingParticipantIds([]);
        } finally {
          setIsLoadingParticipants(false);
        }
      } else {
        setIsLoadingParticipants(false);
      }
    };

    fetchParticipants();
  }, [sessionId, studyId, baseSavePath]);

  const endSession = async () => {
    try {
      // ... (endSession logic remains the same)
      if (!sessionId || !baseSavePath) {
        alert("Session details not found. Please initialize a session first.");
        return;
      }
      
      const res = await axios.post("http://localhost:8000/end-session", {
        save_path: baseSavePath,
        session_id: sessionId,
        notes: notes,
      });
      alert(res.data.message + "\nCSV: " + res.data.csv_path);
      
      setSessionId("");
      setTrials([]);
      setNotes({});
      
      localStorage.removeItem('sessionId');
      localStorage.removeItem('studyId');
      localStorage.removeItem('baseSavePath');

      navigate('/Session-Init'); // 💡 Redirect to the Session Initialization page

    } catch (err) {
      console.error("Failed to end session:", err);
      alert("Error ending session.");
    }
  };

  const startRecording = async () => {
    try {
      if (!sessionId || !selectedParticipantId || !activityName || !studyId || !baseSavePath) {
        alert("Please select a participant and enter an activity.");
        return false;
      }
      
      const filename = `${selectedParticipantId}_${activityName}`;
      
      const res = await axios.post("http://localhost:8000/start-recording", {
        name: filename,
        session_id: sessionId,
        save_path: baseSavePath,
        study_id: studyId,
      });
      
      setSessionId(res.data.session_id);
      
      const now = new Date();
      const newTrial = {
        name: filename,
        dateTime: now.toLocaleString(),
      };
      setTrials([...trials, newTrial]);
      return true; // 💡 Signal success
    } catch (err) {
      console.error("Failed to start recording:", err);
      alert("Error starting recording.");
      return false; // 💡 Signal failure
    }
  };

  const stopRecording = async () => {
    try {
      if (!sessionId || !baseSavePath || !studyId) {
        alert("No active session or session details missing!");
        return false;
      }
      
      const filename = `${selectedParticipantId}_${activityName}`;
      
      const res = await axios.post("http://localhost:8000/stop-recording", {
        session_id: sessionId,
        name: filename,
        save_path: baseSavePath,
        study_id: studyId,
      });
      alert("Video saved to: " + res.data.path);

      setVideoRefreshTrigger(prev => prev + 1);
      return true; // 💡 Signal success
    } catch (err) {
      console.error("Failed to stop recording:", err);
      alert("Error stopping recording.");
      return false; // 💡 Signal failure
    }
  };

  return (
    <>
      <h2>Video Recorder</h2>
      {sessionId ? (
        <RecordingInterface
          sessionId={sessionId}
          studyId={studyId}
          baseSavePath={baseSavePath}
          selectedParticipantId={selectedParticipantId}
          setSelectedParticipantId={setSelectedParticipantId}
          activityName={activityName}
          setActivityName={setActivityName}
          trials={trials}
          setTrials={setTrials}
          notes={notes}
          setNotes={setNotes}
          endSession={endSession}
          isLoadingParticipants={isLoadingParticipants}
          existingParticipantIds={existingParticipantIds}
          startRecording={startRecording}
          stopRecording={stopRecording}
          videoRefreshTrigger={videoRefreshTrigger}
          setVideoRefreshTrigger={setVideoRefreshTrigger}
        />
      ) : (
        <div style={{ textAlign: "center", marginTop: "4rem" }}>
          <h3>Get Started</h3>
          <p>It looks like you don't have an active session. Please start one to begin recording videos.</p>
          <Link to="/Session-Init">
            <button style={{ padding: "1rem 2rem", fontSize: "1.2rem", cursor: "pointer" }}>
              Initialize New Session
            </button>
          </Link>
        </div>
      )}
    </>
  );
};