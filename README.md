# Ayanokoji Voice Interface

A mobile-first, highly optimized voice conversation interface built for deployment on Vercel or any static hosting service. It connects directly to an n8n webhook to simulate a conversational AI flow, complete with automated speech recognition and audio playback.

## Features
- **Mobile First**: Built specifically for Android Chrome, Samsung Internet, and Mobile Safari.
- **Glassmorphism Design**: High-end aesthetics, dark mode, vibrant colors, and responsive micro-animations.
- **Continuous Voice Conversation**: Auto-listens, handles voice pauses, and automatically resumes listening after the AI finishes speaking.
- **Zero Build Step**: Native HTML, CSS, and JS. Ready for instant deployment.

## Deployment Instructions

### 1. GitHub Upload
This project is fully ready for GitHub.
1. Initialize a Git repository locally:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```
2. Create a new repository on GitHub.
3. Link and push to your repository:
   ```bash
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

### 2. Vercel Deployment
Because this project requires no build step and relies on static files, it can be deployed on Vercel with zero modifications.
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New** > **Project**.
3. Import the GitHub repository you just created.
4. Leave all settings as default (Framework Preset: "Other", Build Command: empty).
5. Click **Deploy**. Your site will be live in seconds.

### 3. n8n Webhook Setup
1. In your n8n workspace, create a **Webhook Node**.
2. Set the Method to **POST**.
3. Set the Path to `ayanokoji` (or matching your `config.js`).
4. The frontend sends JSON like this:
   ```json
   {
       "message": "User's spoken text"
   }
   ```
5. In your n8n workflow, parse this text, generate an AI response, and create an audio URL (e.g., using ElevenLabs or OpenAI TTS).
6. Your final node must return JSON in exactly this format using a **Respond to Webhook Node**:
   ```json
   {
       "response": "AI text response",
       "audioUrl": "https://url-to-audio-file.mp3"
   }
   ```
7. Once deployed, update `config.js` in this project to point to your *Production* Webhook URL.

### 4. Browser Microphone Permissions
For speech recognition to work, the site must be served over **HTTPS** (which Vercel provides automatically).
1. When opening the app for the first time, click the Microphone button.
2. The browser will prompt for Microphone access. Tap **Allow**.
3. **Note on iOS/Safari**: Safari requires explicit user interaction to play audio for the first time. The initial tap on the microphone satisfies this requirement, enabling the AI's audio to play seamlessly thereafter.

## Configuration
Edit `config.js` to point to your n8n webhook URL.

```javascript
const CONFIG = {
    WEBHOOK_URL: "https://YOUR-N8N-DOMAIN/webhook/ayanokoji"
};
```
