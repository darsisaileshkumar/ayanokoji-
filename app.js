document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const micBtn = document.getElementById('mic-btn');
    const statusIndicator = document.querySelector('.status-indicator');
    const statusText = document.querySelector('.status-text');
    const chatContainer = document.getElementById('chat-container');

    // State
    let isListening = false;
    let isSpeaking = false;
    let recognition = null;
    let audioPlayer = new Audio();
    
    // Check Speech Recognition Support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        alert("Your browser does not support Speech Recognition. Please use Chrome or Safari.");
        statusText.textContent = "Not Supported";
        return;
    }

    // Initialize Speech Recognition
    recognition = new SpeechRecognition();
    recognition.continuous = true; // Wait for the user to stop naturally
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    // Handle audio ending -> resume listening
    audioPlayer.addEventListener('ended', () => {
        isSpeaking = false;
        updateStatus();
        if (isListening) {
            startListening();
        }
    });

    // Toggle Listening
    micBtn.addEventListener('click', () => {
        if (isListening) {
            stopListening();
            isListening = false;
        } else {
            isListening = true;
            // If it was speaking, stop audio to interrupt
            if (isSpeaking) {
                audioPlayer.pause();
                audioPlayer.currentTime = 0;
                isSpeaking = false;
            }
            startListening();
        }
        updateStatus();
    });

    function startListening() {
        if (!recognition || isSpeaking) return;
        try {
            recognition.start();
            micBtn.classList.add('active');
            statusIndicator.classList.add('listening');
            statusText.textContent = "Listening...";
        } catch (e) {
            // Already started
            console.log(e);
        }
    }

    function stopListening() {
        if (!recognition) return;
        try {
            recognition.stop();
            micBtn.classList.remove('active');
            statusIndicator.classList.remove('listening');
            statusText.textContent = "Standby";
        } catch (e) {
            console.log(e);
        }
    }

    recognition.onresult = async (event) => {
        // Get the latest transcript
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript.trim();

        if (transcript) {
            addMessage(transcript, 'user');
            
            // Temporary stop listening while fetching & playing
            stopListening();
            
            await handleConversation(transcript);
        }
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed') {
            isListening = false;
            stopListening();
            updateStatus();
            alert("Microphone access is required.");
        }
        // Auto resume on network error or no speech, if still intended to be listening
        if (isListening && !isSpeaking && event.error !== 'not-allowed') {
            setTimeout(startListening, 1000);
        }
    };

    recognition.onend = () => {
        // If it ended naturally but we still want to listen and are not speaking
        if (isListening && !isSpeaking) {
            startListening();
        }
    };

    async function handleConversation(text) {
        showTypingIndicator();
        try {
            const response = await fetch(CONFIG.WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: text })
            });

            if (!response.ok) throw new Error("Webhook failed");

            const data = await response.json();
            
            removeTypingIndicator();
            
            if (data.response) {
                addMessage(data.response, 'ai');
            }

            if (data.audioUrl) {
                playAudio(data.audioUrl);
            } else if (isListening) {
                // Resume listening if no audio to play
                startListening();
            }
        } catch (error) {
            console.error("Error communicating with Ayanokoji:", error);
            removeTypingIndicator();
            addMessage("I'm having trouble connecting right now.", 'ai');
            if (isListening) startListening();
        }
    }

    function playAudio(url) {
        isSpeaking = true;
        updateStatus();
        audioPlayer.src = url;
        audioPlayer.play().catch(e => {
            console.error("Audio playback error:", e);
            isSpeaking = false;
            if (isListening) startListening();
            updateStatus();
        });
    }

    function addMessage(text, sender) {
        // Remove welcome message if it exists
        const welcome = document.querySelector('.welcome-message');
        if (welcome) welcome.remove();

        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;
        msgDiv.textContent = text;
        chatContainer.appendChild(msgDiv);
        scrollToBottom();
    }

    let typingIndicator;
    function showTypingIndicator() {
        typingIndicator = document.createElement('div');
        typingIndicator.className = 'message-typing';
        typingIndicator.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        chatContainer.appendChild(typingIndicator);
        scrollToBottom();
    }

    function removeTypingIndicator() {
        if (typingIndicator) {
            typingIndicator.remove();
            typingIndicator = null;
        }
    }

    function scrollToBottom() {
        chatContainer.scrollTo({
            top: chatContainer.scrollHeight,
            behavior: 'smooth'
        });
    }

    function updateStatus() {
        if (isSpeaking) {
            statusIndicator.classList.remove('listening');
            statusIndicator.classList.add('speaking');
            statusText.textContent = "Speaking";
            micBtn.classList.remove('active');
        } else if (isListening) {
            statusIndicator.classList.remove('speaking');
            statusIndicator.classList.add('listening');
            statusText.textContent = "Listening";
            micBtn.classList.add('active');
        } else {
            statusIndicator.classList.remove('speaking', 'listening');
            statusText.textContent = "Disconnected";
            micBtn.classList.remove('active');
        }
    }
});
