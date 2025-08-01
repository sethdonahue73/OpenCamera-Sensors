// src/Participants.js
import React from 'react';

function Participants() {
  return (
    <div style={{ padding: "2rem" }}>
      <h2>Participants Management</h2>
      <p>Manage participant information for your sessions here.</p>
      {/* Add your participant management forms/logic here */}
      <h3 style={{ marginTop: "2rem" }}>Add New Participant</h3>
      <form style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "400px" }}>
        <div>
          <label htmlFor="participant-id">Participant ID:</label>
          <input type="text" id="participant-id" name="participant-id" style={{ marginLeft: "0.5rem", padding: "8px" }} />
        </div>
        <div>
          <label htmlFor="age">Age:</label>
          <input type="number" id="age" name="age" style={{ marginLeft: "0.5rem", padding: "8px" }} />
        </div>
        <div>
          <label htmlFor="gender">Gender:</label>
          <select id="gender" name="gender" style={{ marginLeft: "0.5rem", padding: "8px" }}>
            <option value="">Select...</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </div>
        {/* New fields for Height and Weight */}
        <div>
          <label htmlFor="height">Height (cm):</label>
          <input type="number" id="height" name="height" style={{ marginLeft: "0.5rem", padding: "8px" }} />
        </div>
        <div>
          <label htmlFor="weight">Weight (kg):</label>
          <input type="number" id="weight" name="weight" style={{ marginLeft: "0.5rem", padding: "8px" }} />
        </div>
        <button type="submit" style={{ padding: "10px 20px", fontSize: "1rem", marginTop: "1rem" }}>Save Participant</button>
      </form>

      <h3 style={{ marginTop: "3rem" }}>Existing Participants</h3>
      <p>List of participants will appear here...</p>
      {/* You might add a table or list of existing participants */}
    </div>
  );
}

export default Participants;