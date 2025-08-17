import React, { useEffect, useState } from "react";
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import About from "./About";
import Calibration from "./Calibration";
import Participants from "./Participants";
import SessionInitialization from './SessionInitialization';

const Home = () => {
  const [sessionId, setSessionId] = useState("");
  const [studyId, setStudyId] = useState("");
  const [baseSavePath, setBaseSavePath] = useState("");
  
  const [activityName, setActivityName] = useState("");
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [trials, setTrials] = useState([]);
  const [notes, setNotes] = useState({});

  const [existingParticipantIds, setExistingParticipantIds] = useState([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(true);

  // CORRECTED: State to trigger video list refresh is now declared
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
  }, []);

  const endSession = async () => {
    try {
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

    } catch (err) {
      console.error("Failed to end session:", err);
      alert("Error ending session.");
    }
  };

  const startRecording = async () => {
    try {
      if (!sessionId || !selectedParticipantId || !activityName || !studyId || !baseSavePath) {
        alert("Please select a participant, enter an activity, and ensure session details are set.");
        return;
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

    } catch (err) {
      console.error("Failed to start recording:", err);
      alert("Error starting recording.");
    }
  };

  const stopRecording = async () => {
    try {
      if (!sessionId || !baseSavePath || !studyId) {
        alert("No active session or session details missing!");
        return;
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

    } catch (err) {
      console.error("Failed to stop recording:", err);
      alert("Error stopping recording.");
    }
  };

  const currentSavePath = `${baseSavePath}/${studyId}/${sessionId}`;

  return (
    <>
      <h2>Video Recorder</h2>
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
              disabled={isLoadingParticipants}
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
            />
          </div>

          <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
            <button
              onClick={startRecording}
              style={{ padding: "1rem 2rem", fontSize: "1.2rem", cursor: "pointer" }}
              disabled={!selectedParticipantId || !activityName || !sessionId}
            >
              Start Recording
            </button>
            <button
              onClick={stopRecording}
              style={{ padding: "1rem 2rem", fontSize: "1.2rem", cursor: "pointer" }}
              disabled={!sessionId}
            >
              Stop Recording
            </button>
          </div>
          <button
            onClick={endSession}
            style={{ marginTop: "1rem", padding: "0.5rem 1rem", cursor: "pointer" }}
            disabled={!sessionId}
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

// ... (TrialList and VideoSelector components from before)
const TrialList = ({ sessionId, trials, notes, setNotes }) => {
  return (
    <div style={{ marginTop: "2rem" }}>
      <h3>Trials for Session: {sessionId}</h3>
      {trials.length === 0 ? (
        <p>No trials recorded yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid #ccc", padding: "8px", textAlign: "left" }}>Trial Name</th>
              <th style={{ border: "1px solid #ccc", padding: "8px", textAlign: "left" }}>Date & Time</th>
              <th style={{ border: "1px solid #ccc", padding: "8px", textAlign: "left" }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {trials.map((trial, index) => (
              <tr key={index}>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>{trial.name}</td>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>{trial.dateTime}</td>
                <td style={{ border: "1px solid #ccc", padding: "8px" }}>
                  <textarea
                    value={notes[trial.name] || ""}
                    onChange={(e) => setNotes({ ...notes, [trial.name]: e.target.value })}
                    style={{ width: "100%", minHeight: "50px" }}
                    placeholder="Add notes for this trial..."
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

function VideoSelector({ sessionId, savePath, studyId, refreshTrigger }) {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);

  useEffect(() => {
    if (!sessionId || !savePath || !studyId) return;

    async function fetchVideos() {
      try {
        const res = await axios.get("http://localhost:8000/list-videos", {
          params: { session_id: sessionId, save_path: savePath, study_id: studyId },
        });

        const allVideos = [null, ...res.data.videos];
        setVideos(allVideos);
        setSelectedVideo(null);
      } catch (err) {
        console.error("Failed to fetch videos", err);
        setVideos([null]);
        setSelectedVideo(null);
      }
    }

    fetchVideos();
  }, [sessionId, savePath, studyId, refreshTrigger]);

  const videoUrl =
    selectedVideo && selectedVideo !== "null"
      ? `http://localhost:8000/videos?root_path=${encodeURIComponent(
          savePath
        )}&session_id=${encodeURIComponent(
          sessionId
        )}&study_id=${encodeURIComponent(
          studyId
        )}&video_name=${encodeURIComponent(selectedVideo)}`
      : null;

  return (
    <div>
      <label htmlFor="video-select">Select Video:</label>
      <select
        id="video-select"
        value={selectedVideo || "null"}
        onChange={(e) =>
          setSelectedVideo(e.target.value === "null" ? null : e.target.value)
        }
      >
        <option value="null">None</option>
        {videos
          .filter((v) => v !== null)
          .map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
      </select>

      {selectedVideo ? (
        <video
          key={selectedVideo}
          src={videoUrl}
          controls
          style={{
            width: "640px",
            height: "360px",
            marginTop: "1rem",
            borderRadius: "8px",
          }}
        />
      ) : (
        <div
          style={{
            width: "1080px",
            height: "720px",
            backgroundColor: "black",
            marginTop: "1rem",
            borderRadius: "8px",
          }}
        />
      )}
    </div>
  );
}

function App() {
  const [savePath, setSavePath] = useState("c:/Videos/Test Video Data");

  return (
    <Router>
      <div style={{ padding: "2rem" }}>
        <nav>
          <ul style={{ listStyle: "none", padding: 0, display: "flex", gap: "1rem" }}>
            <li><Link to="/about">About</Link></li>
            <li><Link to="/Session-Init">Session Initialization</Link></li>
            <li><Link to="/calibration">Calibration</Link></li>
            <li><Link to="/participants">Participants</Link></li>
            <li><Link to="/">Home</Link></li>
          </ul>
        </nav>

        <Routes>
          <Route path="/about" element={<About />} />
          <Route path="/Session-Init" element={<SessionInitialization setSavePath={setSavePath} />} />
          <Route path="/calibration" element={<Calibration />} />
          <Route path="/participants" element={<Participants />} />
          <Route path="/" element={<Home />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;