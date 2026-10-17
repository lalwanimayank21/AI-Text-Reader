// ==========================================================================
// ElevenLabs AI Text-to-Speech Frontend Logic
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const textInput = document.getElementById('textInput');
  const charCount = document.getElementById('charCount');
  const wordCount = document.getElementById('wordCount');
  const clearTextBtn = document.getElementById('clearTextBtn');
  const voiceSelect = document.getElementById('voiceSelect');
  const generateBtn = document.getElementById('generateBtn');
  const btnContent = generateBtn.querySelector('.btn-content');
  const btnLoader = generateBtn.querySelector('.btn-loader');
  const statusMessage = document.getElementById('statusMessage');
  const audioResultCard = document.getElementById('audioResultCard');
  const audioPlayer = document.getElementById('audioPlayer');
  const soundWave = document.getElementById('soundWave');
  const downloadAudioBtn = document.getElementById('downloadAudioBtn') || document.getElementById('downloadBtn');
  const replayBtn = document.getElementById('replayBtn');
  const generationMeta = document.getElementById('generationMeta');
  const apiKeyNotice = document.getElementById('apiKeyNotice');
  const dismissNoticeBtn = document.getElementById('dismissNoticeBtn');
  const sampleChips = document.querySelectorAll('.sample-chip');

  // Keep track of active audio Object URL to clean up memory
  let activeAudioUrl = null;
  let maxTextLength = 2500;
  const maxCharLimitEl = document.getElementById('maxCharLimit');

  // ------------------------------------------------------------------------
  // 1. Check Backend & API Key Status and Available Voices on Load
  // ------------------------------------------------------------------------
  async function checkServerStatus() {
    try {
      const response = await fetch('/api/status');
      if (response.ok) {
        const data = await response.json();
        
        // Sync maximum allowed text length with server
        if (data.maxTextLength && typeof data.maxTextLength === 'number') {
          maxTextLength = data.maxTextLength;
          textInput.maxLength = maxTextLength;
          if (maxCharLimitEl) {
            maxCharLimitEl.textContent = maxTextLength.toLocaleString();
          }
        }

        // Show banner if API key is not yet provided in .env
        if (!data.configured && apiKeyNotice) {
          apiKeyNotice.style.display = 'flex';
        }

        // Set default voice if provided from backend
        if (data.defaultVoiceId && voiceSelect) {
          const matchOption = Array.from(voiceSelect.options).find(opt => opt.value === data.defaultVoiceId);
          if (matchOption) {
            voiceSelect.value = data.defaultVoiceId;
          }
        }

        // Fetch available voices from backend if configured
        if (data.configured) {
          await loadAvailableVoices(data.defaultVoiceId);
        }
      }
    } catch (err) {
      console.warn('Could not connect to /api/status endpoint:', err);
    }
  }

  /**
   * Loads voices from the existing GET /api/voices endpoint.
   * If available, dynamically populates the voice selector dropdown.
   */
  async function loadAvailableVoices(defaultVoiceId) {
    try {
      const response = await fetch('/api/voices');
      const data = await response.json();

      if (response.ok && Array.isArray(data.voices) && data.voices.length > 0) {
        const previousSelection = voiceSelect.value || defaultVoiceId;
        
        voiceSelect.innerHTML = '';
        data.voices.forEach(voice => {
          const opt = document.createElement('option');
          opt.value = voice.id;
          const descriptionText = voice.description 
            ? ` — ${voice.description}` 
            : (voice.category ? ` — [${voice.category}]` : '');
          opt.textContent = `${voice.name}${descriptionText}`;
          voiceSelect.appendChild(opt);
        });

        // Restore or set preferred voice
        if (Array.from(voiceSelect.options).some(o => o.value === previousSelection)) {
          voiceSelect.value = previousSelection;
        } else if (defaultVoiceId && Array.from(voiceSelect.options).some(o => o.value === defaultVoiceId)) {
          voiceSelect.value = defaultVoiceId;
        }
      }
    } catch (err) {
      console.warn('Could not load voices from /api/voices:', err);
    }
  }

  // Dismiss API key banner
  if (dismissNoticeBtn) {
    dismissNoticeBtn.addEventListener('click', () => {
      apiKeyNotice.style.display = 'none';
    });
  }

  // ------------------------------------------------------------------------
  // 2. Character & Word Counting
  // ------------------------------------------------------------------------
  function updateTextStats() {
    const text = textInput.value;
    const length = text.length;
    charCount.textContent = length.toLocaleString();

    // Word count calculation
    const words = text.trim().split(/\s+/).filter(Boolean);
    wordCount.textContent = words.length.toLocaleString();

    // Visual warning when nearing character limit
    if (length > maxTextLength * 0.9) {
      charCount.style.color = '#f59e0b';
    } else {
      charCount.style.color = '';
    }
  }

  textInput.addEventListener('input', updateTextStats);

  // Clear text button
  clearTextBtn.addEventListener('click', () => {
    textInput.value = '';
    updateTextStats();
    textInput.focus();
    hideStatus();
    if (downloadAudioBtn) {
      downloadAudioBtn.style.display = 'none';
      downloadAudioBtn.href = '#';
    }
    if (audioResultCard) {
      audioResultCard.style.display = 'none';
    }
    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer.src = '';
    }
  });

  // ------------------------------------------------------------------------
  // 3. Quick Sample Text Insertion
  // ------------------------------------------------------------------------
  sampleChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const sample = chip.getAttribute('data-sample');
      if (sample) {
        textInput.value = sample;
        updateTextStats();
        hideStatus();
        textInput.focus();
      }
    });
  });

  // ------------------------------------------------------------------------
  // 4. Status & Message Helpers
  // ------------------------------------------------------------------------
  function showStatus(message, type = 'error') {
    statusMessage.textContent = message;
    statusMessage.className = `status-box ${type}`;
    statusMessage.style.display = 'block';
  }

  function hideStatus() {
    statusMessage.style.display = 'none';
    statusMessage.textContent = '';
  }

  // ------------------------------------------------------------------------
  // 5. Soundwave Animation Sync with Audio Player
  // ------------------------------------------------------------------------
  audioPlayer.addEventListener('play', () => {
    soundWave.classList.add('playing');
  });

  audioPlayer.addEventListener('pause', () => {
    soundWave.classList.remove('playing');
  });

  audioPlayer.addEventListener('ended', () => {
    soundWave.classList.remove('playing');
  });

  // Replay button
  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      if (audioPlayer.src) {
        audioPlayer.currentTime = 0;
        audioPlayer.play().catch(err => console.log('Autoplay blocked:', err));
      }
    });
  }

  // ------------------------------------------------------------------------
  // 6. Generate Voice Handler (Click event on Generate Voice button)
  // ------------------------------------------------------------------------
  generateBtn.addEventListener('click', async () => {
    const text = textInput.value.trim();
    const selectedVoiceId = voiceSelect.value;
    const selectedVoiceName = voiceSelect.options[voiceSelect.selectedIndex]?.text?.split('—')[0]?.trim() || 'Selected Voice';

    // Validation: Ensure text is provided
    if (!text) {
      showStatus('Please enter some text in the box above to generate voice.', 'error');
      textInput.focus();
      return;
    }

    if (text.length > maxTextLength) {
      showStatus(`Text exceeds the ${maxTextLength.toLocaleString()} character limit. Please shorten your text.`, 'error');
      return;
    }

    hideStatus();
    setLoadingState(true);

    // Hide previous audio result and download button while generating
    if (audioResultCard) {
      audioResultCard.style.display = 'none';
    }
    if (downloadAudioBtn) {
      downloadAudioBtn.style.display = 'none';
      downloadAudioBtn.href = '#';
    }

    const startTime = performance.now();

    try {
      // Send request to Express backend
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          voiceId: selectedVoiceId
        })
      });

      if (!response.ok) {
        let errorMsg = 'Failed to generate voice. Please try again.';
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMsg = errorData.error;
          }
        } catch {
          const rawText = await response.text().catch(() => null);
          if (rawText) errorMsg = rawText;
        }
        showStatus(errorMsg, 'error');
        return;
      }

      // Convert audio binary stream to blob
      const audioBlob = await response.blob();
      
      // Cleanup previous Object URL if existing
      if (activeAudioUrl) {
        URL.revokeObjectURL(activeAudioUrl);
      }

      // Create new Object URL for the MP3 blob
      activeAudioUrl = URL.createObjectURL(audioBlob);

      // Setup audio player
      audioPlayer.src = activeAudioUrl;

      // Setup and reveal Download Audio button
      const safeVoiceName = selectedVoiceName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const downloadFileName = `elevenlabs-${safeVoiceName}-${Date.now()}.mp3`;

      if (downloadAudioBtn) {
        downloadAudioBtn.href = activeAudioUrl;
        downloadAudioBtn.download = downloadFileName;
        downloadAudioBtn.setAttribute('download', downloadFileName);
        // Show the Download button only when audio is ready
        downloadAudioBtn.style.display = 'inline-flex';
      }

      // Update generation metadata
      const durationSeconds = ((performance.now() - startTime) / 1000).toFixed(1);
      generationMeta.textContent = `Generated with ${selectedVoiceName} in ${durationSeconds}s`;

      // Reveal Audio Result Card
      audioResultCard.style.display = 'flex';

      // Auto-play audio (browsers allow play after explicit user click)
      audioPlayer.play().catch(err => {
        console.log('Autoplay requires user interaction:', err);
      });

      // Scroll smoothly to the audio player
      audioResultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (err) {
      console.error('TTS Request Error:', err);
      showStatus(
        'Could not connect to the backend server. Make sure the Node server is running on http://localhost:3000.',
        'error'
      );
    } finally {
      setLoadingState(false);
    }
  });

  // ------------------------------------------------------------------------
  // 7. Loading State Manager
  // ------------------------------------------------------------------------
  function setLoadingState(isLoading) {
    if (isLoading) {
      generateBtn.disabled = true;
      btnContent.style.display = 'none';
      btnLoader.style.display = 'inline-flex';
    } else {
      generateBtn.disabled = false;
      btnContent.style.display = 'inline-flex';
      btnLoader.style.display = 'none';
    }
  }

  // Initialize
  updateTextStats();
  checkServerStatus();
});
