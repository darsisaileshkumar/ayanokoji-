document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const orb = document.getElementById('orb');
    const statusText = document.getElementById('status-text');
    const chatContainer = document.getElementById('chat-container');
    const appTitle = document.getElementById('app-title');
    const debugPanel = document.getElementById('debug-panel');
    const debugHeader = document.querySelector('.debug-header');

    // Debug Elements
    const debugSessionId = document.getElementById('debug-session-id');
    const debugWebhookUrl = document.getElementById('debug-webhook-url');
    const debugReqTime = document.getElementById('debug-req-time');
    const debugResTime = document.getElementById('debug-res-time');
    const debugDuration = document.getElementById('debug-duration');
    const debugState = document.getElementById('debug-state');

    // State Variables
    let currentState = 'Disconnected'; // Disconnected, Listening, Thinking, Speaking
    let recognition = null;
    let audioPlayer = new Audio();
    let sessionId = localStorage.getItem('sessionId');
    
    // Debug tracking
    let lastRequestTime = 0;
    let clickCount = 0;
    let clickTimer = null;

    // Initialization
    if (!sessionId) {
        sessionId = 'sess_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('sessionId', sessionId);
    }
    
    // Check Speech Recognition Support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Your browser does not support Speech Recognition. Please use Chrome or Safari.");
        updateState('Error');
        statusText.textContent = "Not Supported";
        return;
    }

    // Initialize Speech Recognition
    recognition = new SpeechRecognition();
    recognition.continuous = false; // We will restart it manually for the continuous loop
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    // Handle Audio Events
    audioPlayer.addEventListener('ended', () => {
        if (currentState === 'Speaking') {
            updateState('Listening');
            startListening();
        }
    });

    audioPlayer.addEventListener('error', () => {
        console.error("Audio playback failed.");
        if (currentState === 'Speaking') {
            updateState('Listening');
            startListening();
        }
    });

    // Orb Click - Manual Start/Stop
    orb.addEventListener('click', () => {
        if (currentState === 'Disconnected' || currentState === 'Error') {
            updateState('Listening');
            startListening();
        } else if (currentState === 'Listening') {
            stopListening();
            updateState('Disconnected');
        } else if (currentState === 'Speaking') {
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
            updateState('Listening');
            startListening();
        }
    });

    // Speech Recognition Events
    recognition.onstart = () => {
        if (currentState !== 'Listening') {
            updateState('Listening');
        }
    };

    recognition.onaudiostart = () => console.log("Audio capturing started");
    recognition.onspeechstart = () => console.log("Speech detected");
    recognition.onspeechend = () => console.log("Speech stopped");

    recognition.onend = () => {
        console.log("Recognition ended naturally.");
        // If it ended automatically but we should be listening, restart it
        if (currentState === 'Listening') {
            setTimeout(() => {
                try {
                    if (currentState === 'Listening') recognition.start();
                } catch (e) {}
            }, 250);
        }
    };

    recognition.onerror = (event) => {
        // Hide the harmless 'no-speech' timeout from flooding the console
        if (event.error !== 'no-speech') {
            console.error("Speech recognition error:", event.error);
        }
        if (event.error === 'not-allowed') {
            updateState('Disconnected');
            alert("Microphone access is required.");
        }
    };

    recognition.onresult = async (event) => {
        console.log("Speech result received!", event.results);
        const transcript = event.results[0][0].transcript.trim();
        
        if (transcript) {
            console.log("Transcript:", transcript);
            addMessage(transcript, 'user');
            stopListening();
            await processWebhook(transcript);
        } else {
            console.log("Transcript was empty.");
        }
    };

    function startListening() {
        try {
            recognition.start();
        } catch (e) {}
    }

    function stopListening() {
        try {
            recognition.stop();
        } catch (e) {}
    }

    async function processWebhook(transcript) {
        updateState('Thinking');
        
        const timestamp = new Date().toISOString();
        const payload = {
            sessionId: sessionId,
            message: transcript,
            timestamp: timestamp
        };

        // Debug Logs
        console.log("Webhook URL:", WEBHOOK_URL);
        console.log("Request:", payload);

        // Update Debug Panel
        lastRequestTime = performance.now();
        const reqDate = new Date();
        debugReqTime.textContent = reqDate.toLocaleTimeString() + '.' + reqDate.getMilliseconds();
        debugResTime.textContent = 'Waiting...';
        debugDuration.textContent = '-';

        try {
            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Safely parse - n8n may return empty body if "Respond to Webhook" node is missing
            const rawText = await response.text();
            if (!rawText || rawText.trim() === '') {
                console.warn("n8n returned an empty response. Add a 'Respond to Webhook' node to your workflow.");
                addMessage("Received your message, but n8n returned no response. Please add a 'Respond to Webhook' node.", 'error');
                updateState('Listening');
                startListening();
                return;
            }

            let data;
            try {
                data = JSON.parse(rawText);
            } catch (e) {
                console.warn("n8n response was not valid JSON:", rawText);
                // Display raw text if it's not JSON
                addMessage(rawText, 'ai');
                updateState('Listening');
                startListening();
                return;
            }
            
            // Calculate timing
            const responseTime = performance.now();
            const resDate = new Date();
            const duration = (responseTime - lastRequestTime).toFixed(0);
            
            debugResTime.textContent = resDate.toLocaleTimeString() + '.' + resDate.getMilliseconds();
            debugDuration.textContent = duration + 'ms';
            console.log("Response:", data);

            // Handle successful response - support both 'response' and 'output' field names
            const aiText = data.response || data.output || data.text || data.message;
            if (aiText) {
                addMessage(aiText, 'ai');
            }

            if (data.audioUrl) {
                updateState('Speaking');
                audioPlayer.src = data.audioUrl;
                audioPlayer.play().catch(e => {
                    console.error("Audio playback error:", e);
                    updateState('Listening');
                    startListening();
                });
            } else {
                updateState('Listening');
                startListening();
            }

        } catch (error) {
            console.error("Webhook error:", error);
            const resDate = new Date();
            debugResTime.textContent = resDate.toLocaleTimeString() + " (ERROR)";
            
            addMessage("Connection to mentor unavailable.", 'error');
            
            // Auto resume listening even on error
            updateState('Listening');
            startListening();
        }
    }

    function addMessage(text, sender) {
        const welcome = document.querySelector('.welcome-message');
        if (welcome) welcome.remove();

        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;
        msgDiv.textContent = text;
        chatContainer.appendChild(msgDiv);
        chatContainer.scrollTo({
            top: chatContainer.scrollHeight,
            behavior: 'smooth'
        });
    }

    function updateState(newState) {
        currentState = newState;
        statusText.textContent = newState;
        debugState.textContent = newState;
        
        // Remove old state classes
        orb.classList.remove('disconnected', 'listening', 'thinking', 'speaking', 'error');
        
        // Add new state class
        orb.classList.add(newState.toLowerCase());
    }

    // Hidden Debug Panel Toggle Logic
    appTitle.addEventListener('click', () => {
        clickCount++;
        if (clickCount >= 5) {
            toggleDebugPanel();
            clickCount = 0;
        }
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => {
            clickCount = 0;
        }, 1000); // 1 second window to click 5 times
    });

    debugHeader.addEventListener('click', () => {
        toggleDebugPanel();
    });

    function toggleDebugPanel() {
        debugPanel.classList.toggle('hidden');
        if (!debugPanel.classList.contains('hidden')) {
            updateDebugStaticValues();
        }
    }

    function updateDebugStaticValues() {
        debugSessionId.textContent = sessionId;
        debugWebhookUrl.textContent = WEBHOOK_URL;
        debugState.textContent = currentState;
    }
});
