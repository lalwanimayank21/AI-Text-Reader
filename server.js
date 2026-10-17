const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

const rateLimit = require('express-rate-limit');

// Load environment variables from .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_TEXT_LENGTH = parseInt(process.env.MAX_TEXT_LENGTH, 10) || 2500;

// Curated popular ElevenLabs voices for quick selection
const POPULAR_VOICES = [
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', description: 'Deep, expressive narration (Male)' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'Warm, British narration (Male)' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Soft, pleasant narration (Female)' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', description: 'Clear, confident (Female)' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', description: 'Playful, bright (Female)' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'Authoritative broadcast (Male)' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Calm, natural (Requires Creator plan)' }
];

// Security Rate Limiters to protect against unauthorized API exhaustion
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 100, // Limit each IP to 100 general requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP. Please try again after a few minutes.'
  }
});

const ttsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 25, // Limit each IP to 25 voice generations per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Voice generation rate limit reached. Up to 25 voice clips can be generated every 15 minutes. Please wait before trying again.'
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/', generalApiLimiter);

/**
 * Health check & status endpoint
 * Informs the frontend whether an API key has been configured in .env
 */
app.get('/api/status', (req, res) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const isConfigured = Boolean(
    apiKey &&
    apiKey.trim() !== '' &&
    apiKey !== 'your_elevenlabs_api_key_here'
  );

  res.json({
    configured: isConfigured,
    defaultVoiceId: process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB',
    modelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
    maxTextLength: MAX_TEXT_LENGTH,
    voices: POPULAR_VOICES
  });
});

/**
 * Available voices endpoint
 * Securely fetches the list of available voices from ElevenLabs using the server-side API key.
 * Never exposes the API key to frontend code.
 */
app.get('/api/voices', async (req, res) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  // Validate server-side API key configuration
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_elevenlabs_api_key_here') {
    return res.status(400).json({
      error: 'ElevenLabs API key is missing or not configured. Please add your ELEVENLABS_API_KEY to the .env file in the project root and restart the server.',
      voices: POPULAR_VOICES
    });
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey.trim(),
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      let errorMessage = `ElevenLabs API error: HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string'
            ? errorData.detail
            : (errorData.detail.message || JSON.stringify(errorData.detail));
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        const rawText = await response.text().catch(() => null);
        if (rawText) errorMessage = rawText;
      }

      if (response.status === 401) {
        errorMessage = 'Invalid ElevenLabs API key. Please check your ELEVENLABS_API_KEY in .env.';
      }

      return res.status(response.status).json({
        error: errorMessage,
        voices: POPULAR_VOICES
      });
    }

    const data = await response.json();
    const voices = (data.voices || []).map(v => ({
      id: v.voice_id,
      name: v.name,
      category: v.category || 'premade',
      description: v.description || (v.labels ? Object.values(v.labels).join(', ') : '') || ''
    }));

    return res.json({
      voices: voices.length > 0 ? voices : POPULAR_VOICES,
      defaultVoiceId: process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'
    });
  } catch (err) {
    console.error('Error fetching ElevenLabs voices:', err);
    return res.status(500).json({
      error: 'Failed to fetch voices from ElevenLabs: ' + (err.message || 'Unknown error'),
      voices: POPULAR_VOICES
    });
  }
});


/**
 * Main Text-to-Speech generation endpoint
 * Securely calls ElevenLabs on the server side using the hidden API key
 */
app.post('/api/tts', ttsLimiter, async (req, res) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    // Validate server-side API key configuration
    if (!apiKey || apiKey.trim() === '' || apiKey === 'your_elevenlabs_api_key_here') {
      return res.status(400).json({
        error: 'ElevenLabs API key is missing or not configured. Please add your ELEVENLABS_API_KEY to the .env file in the project root and restart the server.'
      });
    }

    const { text, voiceId } = req.body;

    // Validate user input text
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        error: 'Please enter some text to generate speech.'
      });
    }

    // Length check to protect API quota
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({
        error: `Text exceeds the maximum allowed limit of ${MAX_TEXT_LENGTH.toLocaleString()} characters.`
      });
    }

    const selectedVoiceId = (voiceId && voiceId.trim()) 
      ? voiceId.trim() 
      : (process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB');

    const modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';

    const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(selectedVoiceId)}`;

    // Call ElevenLabs API
    const response = await fetch(elevenLabsUrl, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey.trim(),
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        }
      })
    });

    // Handle ElevenLabs API errors
    if (!response.ok) {
      let errorMessage = `ElevenLabs API error: HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          if (typeof errorData.detail === 'string') {
            errorMessage = errorData.detail;
          } else if (errorData.detail.message) {
            errorMessage = errorData.detail.message;
          } else {
            errorMessage = JSON.stringify(errorData.detail);
          }
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        const rawText = await response.text().catch(() => null);
        if (rawText) errorMessage = rawText;
      }

      // Provide friendly guidance for common status codes
      if (response.status === 401) {
        errorMessage = 'Invalid ElevenLabs API key. Please check your ELEVENLABS_API_KEY in .env.';
      } else if (response.status === 429) {
        errorMessage = 'ElevenLabs rate limit or quota exceeded. Please check your ElevenLabs account credits.';
      }

      return res.status(response.status).json({ error: errorMessage });
    }

    // Convert audio stream to binary buffer
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    // Stream audio back to frontend
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
      'Cache-Control': 'no-cache'
    });

    res.send(audioBuffer);
  } catch (err) {
    console.error('TTS Generation Error:', err);
    res.status(500).json({
      error: 'An internal server error occurred while processing the voice generation: ' + (err.message || 'Unknown error')
    });
  }
});

// Start Express Server with automatic fallback if default port is in use
function startServer(portToUse) {
  const server = app.listen(portToUse, () => {
    const actualPort = server.address().port;
    console.log(`\n======================================================`);
    console.log(` ElevenLabs AI Voice Generator Server is Running!`);
    console.log(` URL:    http://localhost:${actualPort}`);
    console.log(` Status: http://localhost:${actualPort}/api/status`);
    console.log(`======================================================\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = Number(portToUse) + 1;
      console.warn(`⚠️  Port ${portToUse} is already in use. Retrying on port ${nextPort}...`);
      startServer(nextPort);
    } else {
      console.error('❌ Server startup error:', err);
    }
  });
}

startServer(PORT);

