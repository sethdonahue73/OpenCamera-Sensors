import React, { useState, useEffect } from "react";
import axios from 'axios';

function App() {
  const [filename, setFilename] = useState("recorded_video.mp4");
  const [savePath, setSavePath] = useState("C:\\Users\\sethy\\Videos\\Test Video Data");

  const videoUrl = "http://localhost:8000/videos/recorded_video.mp4";

  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState("");
  const [poseVideoUrl, setPoseVideoUrl] = useState("");

  useEffect(() => {
    axios.get("http://localhost:8000/list-videos").then(res => {
      setVideos(res.data.videos);
    });
  }, []);



  const playCombined = () => {
    window.open("http://localhost:8000/play-combined");
  };

  const startRecording = async () => {
    const res = await axios.post("http://localhost:8000/start-recording");
    alert("Recording started: " + JSON.stringify(res.data));
  };

  const stopRecording = async () => {
    try {
      const res = await axios.post("http://localhost:8000/stop-recording", {
        name: filename,
        save_path: savePath
      });

      alert("Video saved: " + res.data.path);
    } catch (error) {
      console.error("Failed to stop recording:", error);
      alert("Failed to stop recording.");
    }
  };


  const runPoseEstimation = async () => {
  if (!selectedVideo) return;

  const response = await fetch("http://localhost:8000/run-pose-estimation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ video_filename: selectedVideo }),
  });

  const data = await response.json();
  setPoseVideoUrl("http://localhost:8000/" + data.pose_video_path);
};

  // const runPoseEstimation = async () => {
  //   const res = await axios.post("http://localhost:8000/run-pose-estimation", {
  //     video_path: selectedVideo
  //   });
  //   setPoseVideoUrl("http://localhost:8000/" + res.data.pose_video_path);
  // };

return (
  <div style={{ padding: "2rem" }}>
    <h2>Remote Video Control</h2>
    <input
      value={filename}
      onChange={(e) => setFilename(e.target.value)}
      placeholder="Filename"
    />
    <input
      value={savePath}
      onChange={(e) => setSavePath(e.target.value)}
      placeholder="Save path"
    />
    <div style={{ marginTop: "1rem" }}>
      <button onClick={startRecording}>Start Recording</button>
      <button onClick={stopRecording}>Stop Recording</button>
      <button onClick={() => window.open("http://localhost:8000/play-video")}>Play Video</button>
      <button onClick={runPoseEstimation}>Run Pose Estimation</button>
      <button onClick={playCombined}>Play Combined (Keypoints + Video)</button>
    </div>

    {/* Main Video Playback */}
    <div style={{ marginTop: "2rem" }}>
      <h3>Video Playback</h3>
      <video width="640" height="480" controls>
        <source src={videoUrl} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>

    {/* Pose Estimation Tool */}
    <div style={{ marginTop: "4rem" }}>
      <h2>Pose Estimation Tool</h2>
      <select onChange={(e) => setSelectedVideo(e.target.value)} value={selectedVideo}>
        <option value="">Select a video</option>
        {videos.map((video, idx) => (
          <option key={idx} value={video}>{video}</option>
        ))}
      </select>
      <button onClick={runPoseEstimation} disabled={!selectedVideo}>Run Pose Estimation</button>

      {poseVideoUrl && (
        <div style={{ marginTop: "1rem" }}>
          <h4>Combined Video Output</h4>
          <video src={poseVideoUrl} controls width="600" />
        </div>
      )}
    </div>
  </div>
);
}
export default App;
