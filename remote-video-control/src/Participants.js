import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Participants() {
  // State to hold the session and study data
  const [sessionId, setSessionId] = useState("");
  const [studyId, setStudyId] = useState("");
  const [baseSavePath, setBaseSavePath] = useState("");

  // State for the participant form
  const [participantId, setParticipantId] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [birthday, setBirthday] = useState('');
  const [sex, setSex] = useState('');
  const [message, setMessage] = useState('');

  // State for existing IDs and a validation warning
  const [existingParticipantIds, setExistingParticipantIds] = useState([]);
  const [idWarning, setIdWarning] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);

  // State for session initialization
  const [isSessionInitialized, setIsSessionInitialized] = useState(false);
  const [newSessionId, setNewSessionId] = useState("");
  const [newStudyId, setNewStudyId] = useState("");
  const [newBaseSavePath, setNewBaseSavePath] = useState("");

  // Function to fetch the list of participants from the backend
  const fetchExistingParticipants = async (currentStudyId, currentBaseSavePath) => {
    if (currentStudyId && currentBaseSavePath) {
      try {
        const response = await axios.get(`http://localhost:8000/api/participants/list`, {
          params: {
            study_id: currentStudyId,
            base_save_path: currentBaseSavePath
          }
        });
        setExistingParticipantIds(response.data.participant_ids);
      } catch (error) {
        console.error("Failed to fetch existing participants:", error);
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  };

  // Handler for session initialization form
  const handleSessionInitialization = (e) => {
    e.preventDefault();
    if (!newSessionId || !newStudyId || !newBaseSavePath) {
      setMessage("Error: Please fill out all session details.");
      return;
    }
    
    // Save new session data to localStorage
    localStorage.setItem('sessionId', newSessionId);
    localStorage.setItem('studyId', newStudyId);
    localStorage.setItem('baseSavePath', newBaseSavePath);
    
    // Update component state
    setSessionId(newSessionId);
    setStudyId(newStudyId);
    setBaseSavePath(newBaseSavePath);
    setIsSessionInitialized(true);
    setMessage("Session initialized successfully!");
    
    // Fetch participants for the new session
    fetchExistingParticipants(newStudyId, newBaseSavePath);
  };

  // Use the useEffect hook to fetch data from localStorage
  useEffect(() => {
    const storedSessionId = localStorage.getItem('sessionId');
    const storedStudyId = localStorage.getItem('studyId');
    const storedBaseSavePath = localStorage.getItem('baseSavePath');

    if (storedSessionId && storedStudyId && storedBaseSavePath) {
      setSessionId(storedSessionId);
      setStudyId(storedStudyId);
      setBaseSavePath(storedBaseSavePath);
      setIsSessionInitialized(true);
      fetchExistingParticipants(storedStudyId, storedBaseSavePath);
    } else {
      setIsSessionInitialized(false);
      setIsLoading(false);
    }
  }, []);

  // Handler for the participant ID input to check for duplicates in real-time
  const handleParticipantIdChange = (e) => {
    const newId = e.target.value;
    setParticipantId(newId);

    if (existingParticipantIds.includes(newId)) {
      setIdWarning("Warning: A participant with this ID already exists. The data will be updated for this session.");
    } else {
      setIdWarning('');
    }
  };

  // Function to handle form submission and save participant data
  const handleSaveParticipant = async (e) => {
    e.preventDefault();
    setMessage('Saving participant...');

    if (!participantId || !height || !weight || !birthday || !sex) {
      setMessage('Error: Please fill out all participant fields.');
      return;
    }

    const participantData = {
      sessionId,
      studyId,
      baseSavePath,
      participantId,
      height: parseFloat(height),
      weight: parseFloat(weight),
      birthday,
      sex,
    };

    const backendEndpoint = 'http://localhost:8000/api/save-participant';

    try {
      const response = await axios.post(backendEndpoint, participantData);
      const result = response.data;

      if (response.status === 200) {
        setMessage(`Success: ${result.message}`);
        setParticipantId('');
        setHeight('');
        setWeight('');
        setBirthday('');
        setSex('');
        fetchExistingParticipants(studyId, baseSavePath);
      } else {
        setMessage(`Error: ${result.detail || result.message}`);
      }
    } catch (error) {
      setMessage(`Network error: ${error.message}`);
    }
  };

  return (
    <div style={{ padding: "2rem" }}>
      <h2>Participants Management</h2>
      <p>Manage participant information for your sessions here.</p>

      {!isSessionInitialized ? (
        // Session Initialization form
        <div style={{ border: '1px solid #ccc', padding: '1rem', marginTop: '1rem', backgroundColor: '#f9f9f9' }}>
          <h3 style={{ marginTop: "0", marginBottom: "1rem" }}>No active session found. Initialize a new session to add participants.</h3>
          <form onSubmit={handleSessionInitialization} style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "400px" }}>
            <div>
              <label htmlFor="newSessionId">Session ID:</label>
              <input type="text" id="newSessionId" value={newSessionId} onChange={(e) => setNewSessionId(e.target.value)} style={{ marginLeft: "0.5rem", padding: "8px" }} />
            </div>
            <div>
              <label htmlFor="newStudyId">Study ID:</label>
              <input type="text" id="newStudyId" value={newStudyId} onChange={(e) => setNewStudyId(e.target.value)} style={{ marginLeft: "0.5rem", padding: "8px" }} />
            </div>
            <div>
              <label htmlFor="newBaseSavePath">Base Save Path:</label>
              <input type="text" id="newBaseSavePath" value={newBaseSavePath} onChange={(e) => setNewBaseSavePath(e.target.value)} style={{ marginLeft: "0.5rem", padding: "8px" }} />
            </div>
            <button type="submit" style={{ padding: "10px 20px", fontSize: "1rem", marginTop: "1rem" }}>Initialize Session</button>
          </form>
          {message && <p style={{ marginTop: "1rem", color: message.startsWith("Error") ? 'red' : 'green' }}>{message}</p>}
        </div>
      ) : (
        // Existing session components
        <>
          <div style={{ border: '1px solid #ccc', padding: '1rem', marginTop: '1rem', backgroundColor: '#f9f9f9' }}>
            <h3 style={{ marginTop: "0", marginBottom: "1rem" }}>Current Session Details</h3>
            <p><strong>Session ID:</strong> <code>{sessionId || "Not Available"}</code></p>
            <p><strong>Study ID:</strong> <code>{studyId || "Not Available"}</code></p>
            <p><strong>Base Save Path:</strong> <code>{baseSavePath || "Not Available"}</code></p>
          </div>

          <h3 style={{ marginTop: "2rem" }}>Add New Participant</h3>
          <form onSubmit={handleSaveParticipant} style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "400px" }}>
            <div>
              <label htmlFor="participant-id">Participant ID:</label>
              <input type="text" id="participant-id" name="participant-id" value={participantId} onChange={handleParticipantIdChange} style={{ marginLeft: "0.5rem", padding: "8px" }} />
              {idWarning && <p style={{ color: 'orange', fontSize: '0.8rem', marginTop: '0.5rem' }}>{idWarning}</p>}
            </div>
            <div>
              <label htmlFor="height">Height (cm):</label>
              <input type="number" id="height" name="height" value={height} onChange={(e) => setHeight(e.target.value)} style={{ marginLeft: "0.5rem", padding: "8px" }} />
            </div>
            <div>
              <label htmlFor="weight">Weight (kg):</label>
              <input type="number" id="weight" name="weight" value={weight} onChange={(e) => setWeight(e.target.value)} style={{ marginLeft: "0.5rem", padding: "8px" }} />
            </div>
            <div>
              <label htmlFor="birthday">Birthday:</label>
              <input type="date" id="birthday" name="birthday" value={birthday} onChange={(e) => setBirthday(e.target.value)} style={{ marginLeft: "0.5rem", padding: "8px" }} />
            </div>
            <div>
              <label htmlFor="sex">Sex:</label>
              <select id="sex" name="sex" value={sex} onChange={(e) => setSex(e.target.value)} style={{ marginLeft: "0.5rem", padding: "8px" }}>
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
            <button type="submit" style={{ padding: "10px 20px", fontSize: "1rem", marginTop: "1rem" }}>Save Participant</button>
          </form>

          {message && <p style={{ marginTop: "1rem", color: message.startsWith("Error") ? 'red' : 'green' }}>{message}</p>}

          <h3 style={{ marginTop: "3rem" }}>Existing Participants</h3>
          {isLoading ? (
            <p>Loading participants...</p>
          ) : existingParticipantIds.length > 0 ? (
            <ul style={{ listStyleType: 'disc', paddingLeft: '20px' }}>
              {existingParticipantIds.map((id, index) => (
                <li key={index}>{id}</li>
              ))}
            </ul>
          ) : (
            <p>No participants found for this study.</p>
          )}
        </>
      )}
    </div>
  );
}

export default Participants;