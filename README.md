# ElevenLabs AI Text-to-Speech Studio

A clean, modern, and fully functional Text-to-Speech web application powered by **ElevenLabs AI** and built with a secure **Node.js & Express** backend and vanilla HTML/CSS/JavaScript frontend.

---

## ✨ Features

- **Custom Text Input**: Enter ANY text you want (up to 5,000 characters) — stories, messages, scripts, or articles.
- **Voice Selection**: Choose from popular ElevenLabs neural voices (Rachel, Adam, Bella, Antoni, Josh, Elli).
- **Single-Click Generation**: Simple, prominent **"Generate Voice"** button.
- **Built-in Audio Player**: Listen directly in the browser with synchronized soundwave animations.
- **MP3 Download**: Download generated speech audio files with one click.
- **Secure Backend**: Your ElevenLabs API key is stored safely on the server in `.env` and is **never** exposed to the client or browser.
- **Modern Glassmorphic UI**: Beautiful dark theme, responsive layout, real-time character/word counter, and helpful status notifications.

---

## 📁 Project Structure

```text
AI-Text -Reader/
├── .env.example       # Template for environment variables
├── .env               # Your local private environment configuration (ignored by git)
├── .gitignore         # Prevents committing node_modules and .env
├── package.json       # Project dependencies and npm scripts
├── server.js          # Express backend server (proxies ElevenLabs API)
├── README.md          # Setup guide and documentation
└── public/            # Frontend static assets
    ├── index.html     # Semantic HTML5 user interface
    ├── style.css      # Modern vanilla CSS styles & animations
    └── app.js         # Frontend JavaScript (DOM & API requests)
```

---

## 🚀 Quick Start & Setup Instructions

### 1. Prerequisites
Ensure you have **Node.js** (v18.0 or higher recommended) installed on your system.

To check your Node version:
```bash
node -v
```

---

### 2. Install Dependencies
Dependencies are already configured in `package.json`. If you need to install them afresh:
```bash
npm install
```

---

### 3. Configure Your ElevenLabs API Key

1. If you don't already have an ElevenLabs account, create one at [elevenlabs.io](https://elevenlabs.io).
2. Grab your API key from [ElevenLabs Profile Settings / API Keys](https://elevenlabs.io/app/settings/api-keys).
3. Open the `.env` file in the root folder of this project:
   ```env
   ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
   ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
   ELEVENLABS_MODEL_ID=eleven_multilingual_v2
   PORT=3000
   ```
4. Replace `your_elevenlabs_api_key_here` with your actual API key and save the file.

> **Security Note:** The `.env` file is listed in `.gitignore` and must never be committed to public repositories or shared.

---

### 4. Start the Application

Start the server using either:

```bash
# Standard start:
npm start

# Or with live reload on file changes (Node 18+):
npm run dev
```

You will see:
```text
======================================================
 ElevenLabs AI Voice Generator Server
 URL: http://localhost:3000
 Status: http://localhost:3000/api/status
======================================================
```

---

### 5. Open in Your Browser

Open your browser and navigate to:
```
http://localhost:3000
```

1. Enter any text in the input box.
2. Select your preferred voice model (or leave Rachel as default).
3. Click **"Generate Voice"**.
4. Play and listen to the generated voice, or download the MP3!

---

## 🛠️ API Reference (Backend)

### `GET /api/status`
Checks if `ELEVENLABS_API_KEY` is configured in `.env` and returns default voice metadata.

### `GET /api/voices`
Securely queries the ElevenLabs API using the server-side API key and returns available voice models for the dropdown. If no API key is configured or an error occurs, it returns clear error messages and curated fallback voices.

### `POST /api/tts`
Converts text into audio stream via ElevenLabs API.

- **Request Body (JSON):**
  ```json
  {
    "text": "Hello world! This is AI text to speech.",
    "voiceId": "21m00Tcm4TlvDq8ikWAM"
  }
  ```
- **Response:**
  - `Content-Type: audio/mpeg`
  - Binary audio stream ready for playback or download.

---

## 🔒 Security Best Practices

- **Never Commit `.env`**: The `.gitignore` file is configured to strictly exclude `.env` and all `.env.*` files. Never commit API keys to version control.
- **Server-Side API Proxy**: The frontend client never contacts ElevenLabs directly. All calls are securely proxied through the Express backend (`/api/tts` and `/api/voices`).
- **Zero Client Exposure**: No sensitive keys, tokens, or credentials exist in HTML, CSS, client-side JavaScript, or HTTP response payloads.
- **Rate Limiting & Quota Guards**: Built-in rate limiters (`express-rate-limit`) protect endpoints from brute-force spam or accidental quota drainage, with configurable text-length caps (`MAX_TEXT_LENGTH`).

---

## ☁️ Deploying & Uploading to GitHub

When uploading this project to GitHub:
1. Run `git status` after `git init` and `git add .` to verify that `.env` is **NOT** listed in staged files.
2. Push your project to GitHub. Only `.env.example` will be uploaded.
3. In your deployment hosting platform (Render, Railway, Heroku, AWS, DigitalOcean), configure your environment variables in the host dashboard:
   - `ELEVENLABS_API_KEY`: `<your_actual_api_key>`
   - `ELEVENLABS_VOICE_ID`: `pNInz6obpgDQGcFmaJgB` *(optional)*
   - `ELEVENLABS_MODEL_ID`: `eleven_multilingual_v2` *(optional)*
   - `MAX_TEXT_LENGTH`: `2500` *(optional)*

