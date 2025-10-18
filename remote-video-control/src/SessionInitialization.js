import React, { useState, useEffect } from 'react';

// Helper function to generate a timestamped session suffix
const generateTimestampSuffix = () => {
    const now = new Date();
    const datePart = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, '0') + "-" + String(now.getDate()).padStart(2, '0');
    const timePart = String(now.getHours()).padStart(2, '0') + "-" + String(now.getMinutes()).padStart(2, '0') + "-" + String(now.getSeconds()).padStart(2, '0');
    return `${datePart}_${timePart}`;
};

function SessionInitialization() {
    // --- State Variables for User Inputs ---
    const [studyId, setStudyId] = useState(localStorage.getItem('studyId') || "");
    const [sessionIdInput, setSessionIdInput] = useState(localStorage.getItem('sessionIdInput') || "");
    const [smartphoneIp, setSmartphoneIp] = useState(localStorage.getItem('smartphoneIp') || "192.168.4.245");
    const [baseSavePath, setBaseSavePath] = useState(localStorage.getItem('baseSavePath') || "C:\\OpenCameraVideos"); 
    
    // Derived state for the unique session ID and full path
    const [sessionId, setSessionId] = useState("");
    const [location, setLocation] = useState("");

    // State for lists and selections
    const [configurations, setConfigurations] = useState([]);
    const [selectedConfigName, setSelectedConfigName] = useState("");

    // UI state
    const [message, setMessage] = useState("");
    const [isNavigating, setIsNavigating] = useState(false);
    const [isLoading, setIsLoading] = useState(false); // New state for loading configurations
    
    // A separate state for the initial timestamp, which doesn't change after load
    const [timestampSuffix] = useState(generateTimestampSuffix());

    const fetchConfigurations = async () => {
        setIsLoading(true);
        setMessage("Loading configurations...");
        try {
            const response = await fetch('/get-configurations', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                // If the response is not OK, we'll try to get more info, but handle non-JSON gracefully
                const isJson = response.headers.get('content-type')?.includes('application/json');
                const errorData = isJson ? await response.json() : { detail: 'Server error, not a JSON response.' };
                throw new Error(`Server error: ${errorData.detail || response.statusText}`);
            }

            const isJson = response.headers.get('content-type')?.includes('application/json');
            if (!isJson) {
                // Explicitly throw an error if the response is not JSON, even if it's "OK"
                throw new Error("Received non-JSON response from server. It might be an HTML error page.");
            }
            
            const data = await response.json();
            
            setConfigurations(data.configurations); 
            setMessage("Configurations loaded successfully.");

        } catch (error) {
            console.error("Failed to fetch configurations:", error);
            setMessage(`Error: Failed to load configurations. Please check the backend server and path. (${error.message})`);
            setConfigurations([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Handler to load a selected configuration from the dropdown
    const handleConfigChange = async (e) => {
        const configName = e.target.value;
        setSelectedConfigName(configName);
        
        if (configName) {
            setMessage(`Loading configuration: ${configName}`);
            try {
                // You will need a new backend endpoint to fetch a specific config file.
                // Assuming a new endpoint like '/get-config-details/{config_name}'
                const response = await fetch(`/get-config-details/${configName}`);

                if (!response.ok) {
                    throw new Error("Failed to fetch configuration details.");
                }

                const configData = await response.json();
                
                // Update state variables with data from the selected configuration
                setStudyId(configData.studyId);
                setBaseSavePath(configData.baseSavePath);
                setSmartphoneIp(configData.smartphoneIp);
                setMessage(`Loaded configuration: ${configData.name}`);
            } catch (error) {
                console.error("Failed to fetch configuration details:", error);
                setMessage(`Error: Failed to load configuration details for ${configName}.`);
            }
        } else {
            setMessage("Please select a configuration.");
        }
    };

    // Use a useEffect hook to update the derived sessionId and save path
    useEffect(() => {
        // Construct the full sessionId
        if (sessionIdInput) {
            setSessionId(`${sessionIdInput}_${timestampSuffix}`);
        } else {
            setSessionId(timestampSuffix);
        }

        // Construct the full save path, handling different path separators
        if (studyId && sessionId) {
            const pathSeparator = baseSavePath.endsWith('/') || baseSavePath.endsWith('\\') ? '' : '/';
            setLocation(`${baseSavePath}${pathSeparator}${studyId}/${sessionId}`);
        } else {
            setLocation(baseSavePath);
        }

        // Save values to localStorage for persistence
        localStorage.setItem('studyId', studyId);
        localStorage.setItem('sessionIdInput', sessionIdInput);
        localStorage.setItem('smartphoneIp', smartphoneIp);
        localStorage.setItem('baseSavePath', baseSavePath);
        localStorage.setItem('sessionId', sessionId); // Save the combined ID for the next page
    }, [studyId, sessionIdInput, smartphoneIp, baseSavePath, sessionId, timestampSuffix]);

    // Handler for saving the current configuration to a JSON file (via download)
    const handleSaveConfig = () => {
        if (!studyId) {
            setMessage("Error: Please provide a Study ID to save the configuration.");
            return;
        }

        // Create the JSON object from the current state
        const configData = {
            name: `${studyId}.json`, // Use the studyId to create a name
            studyId: studyId,
            baseSavePath: "C:\\OpenCameraVideos\\configs", // Hardcode the new path
            smartphoneIp: smartphoneIp,
        };

        const jsonString = JSON.stringify(configData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = `${studyId}.json`; // Use the studyId for the filename
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(href);

        setMessage(`Configuration "${studyId}.json" has been prepared for download.`);
    };

    const handleGoToCalibration = () => {
        if (!studyId || !sessionIdInput) {
            setMessage("Error: Please enter both a Study ID and a Session ID.");
            return;
        }
        
        setIsNavigating(true);
        setMessage("Details saved. Navigating to Calibration...");
        
        // This setTimeout simulates a navigation to the next page
        setTimeout(() => {
            console.log("Navigating to /calibration");
            setIsNavigating(false); // Reset for demonstration
        }, 1500);
    };

    return (
        <div className="p-8 max-w-4xl mx-auto font-sans bg-gray-50 min-h-screen">
            <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Session Initialization</h2>
            <p className="text-lg text-gray-600 mb-8 text-center">Enter the details to start a new recording session on the smartphone.</p>

            {/* Configuration Section */}
            <div className="bg-white p-6 rounded-xl shadow-md mb-8">
                <h3 className="text-2xl font-semibold text-gray-700 mb-4 border-b pb-2">Configuration</h3>
                
                {/* Load Configuration Dropdown */}
                <div className="mb-6">
                    <label htmlFor="config-select" className="block text-gray-700 text-sm font-medium mb-2">Load Configuration:</label>
                    <select
                        id="config-select"
                        value={selectedConfigName}
                        onChange={handleConfigChange}
                        onFocus={fetchConfigurations} // This is the new part
                        className="shadow-sm appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 ease-in-out bg-white"
                        disabled={isLoading}
                    >
                        <option value="">
                            {isLoading ? "Loading..." : "-- Select a Configuration --"}
                        </option>
                        {configurations.length > 0 ? (
                            configurations.map(configName => (
                                <option key={configName} value={configName}>{configName}</option>
                            ))
                        ) : (
                            <option disabled>No configurations available</option>
                        )}
                    </select>
                </div>

                <div className="mb-4">
                    <label htmlFor="base-save-path" className="block text-gray-700 text-sm font-medium mb-2">Base Save Path:</label>
                    <input
                        type="text"
                        id="base-save-path"
                        value={baseSavePath}
                        onChange={(e) => setBaseSavePath(e.target.value)}
                        className="shadow-sm appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 ease-in-out"
                        placeholder="e.g., C:\\OpenCameraVideos"
                    />
                </div>
                 {/* New Save Configuration Button */}
                 <button
                    onClick={handleSaveConfig}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition duration-200 ease-in-out text-xl mt-4"
                >
                    Save Current Configuration as JSON
                </button>
            </div>

            {/* Session Details Section */}
            <div className="bg-white p-6 rounded-xl shadow-md mb-8">
                <h3 className="text-2xl font-semibold text-gray-700 mb-4 border-b pb-2">Session Details</h3>
                
                <div className="mb-4">
                    <label htmlFor="study-id" className="block text-gray-700 text-sm font-medium mb-2">Study ID:</label>
                    <input
                        type="text"
                        id="study-id"
                        value={studyId}
                        onChange={(e) => setStudyId(e.target.value)}
                        className="shadow-sm appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 ease-in-out"
                        placeholder="e.g., Study_ABC"
                    />
                </div>
                <div className="mb-4">
                    <label htmlFor="session-id-input" className="block text-gray-700 text-sm font-medium mb-2">Session ID:</label>
                    <input
                        type="text"
                        id="session-id-input"
                        value={sessionIdInput}
                        onChange={(e) => setSessionIdInput(e.target.value)}
                        className="shadow-sm appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 ease-in-out"
                        placeholder="e.g., P001"
                    />
                </div>
                <div className="mb-4">
                    <label htmlFor="smartphone-ip" className="block text-gray-700 text-sm font-medium mb-2">Smartphone IP:</label>
                    <input
                        type="text"
                        id="smartphone-ip"
                        value={smartphoneIp}
                        onChange={(e) => setSmartphoneIp(e.target.value)}
                        className="shadow-sm appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 ease-in-out"
                        placeholder="e.g., 192.168.1.100"
                    />
                </div>
            </div>

            {/* Next Step Section */}
            <div className="bg-blue-50 p-6 rounded-xl shadow-md mb-8">
                <h3 className="text-2xl font-semibold text-blue-700 mb-4 border-b border-blue-200 pb-2">Next Step</h3>
                <div className="mb-4 border border-blue-200 bg-blue-100 p-4 rounded-lg">
                    <p className="text-blue-800 text-lg mb-2 break-words"><strong>Derived Session ID:</strong> <code className="bg-blue-200 px-2 py-1 rounded text-blue-900">{sessionId || "Not set"}</code></p>
                    <p className="text-blue-800 text-lg break-words"><strong>Full Save Path:</strong> <code className="bg-blue-200 px-2 py-1 rounded text-blue-900">{location || "Not set"}</code></p>
                </div>
                <button
                    onClick={handleGoToCalibration}
                    disabled={isNavigating || !studyId || !sessionIdInput}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 ease-in-out text-xl"
                >
                    {isNavigating ? "Saving..." : "Go to Calibration"}
                </button>
                {message && (
                    <p className={`mt-4 text-center text-lg ${message.startsWith('Error:') ? 'text-red-600' : 'text-green-600'}`}>
                        {message}
                    </p>
                )}
            </div>
        </div>
    );
}

export default SessionInitialization;