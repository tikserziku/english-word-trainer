// Google Cloud Text-to-Speech Service
// Free tier: 1 million characters per month
// Works perfectly on mobile browsers

const GOOGLE_TTS_API_KEY = import.meta.env.VITE_GEMINI_API_KEY; // Reuse Gemini key (both are Google APIs)

interface TTSCache {
  [key: string]: string; // word -> audio URL
}

const audioCache: TTSCache = {};

/**
 * Generate speech using Google Cloud Text-to-Speech API
 * This works reliably on mobile devices
 */
export const speakWithGoogleTTS = async (text: string, lang = 'en-US'): Promise<void> => {
  try {
    // Check cache first
    if (audioCache[text]) {
      const audio = new Audio(audioCache[text]);
      audio.play();
      return;
    }

    // Call Google Cloud TTS API
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: lang,
            name: lang === 'en-US' ? 'en-US-Neural2-J' : 'en-US-Standard-C', // High quality voice
            ssmlGender: 'NEUTRAL'
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 0.9, // Slightly slower for learning
            pitch: 0.0,
            volumeGainDb: 0.0
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`TTS API failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.audioContent) {
      // Convert base64 to audio URL
      const audioBlob = base64ToBlob(data.audioContent, 'audio/mp3');
      const audioUrl = URL.createObjectURL(audioBlob);

      // Cache for later use
      audioCache[text] = audioUrl;

      // Play audio
      const audio = new Audio(audioUrl);
      audio.play();
    }
  } catch (error) {
    console.error('Google TTS error:', error);
    // Fallback to browser Speech Synthesis
    fallbackToWebSpeech(text, lang);
  }
};

/**
 * Convert base64 audio to Blob
 */
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Fallback to browser's built-in Speech Synthesis
 */
function fallbackToWebSpeech(text: string, lang: string): void {
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();

    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      speechSynthesis.speak(utterance);
    }, 100);
  }
}

/**
 * Clean up audio cache (call when unmounting)
 */
export const cleanupAudioCache = (): void => {
  Object.values(audioCache).forEach(url => {
    URL.revokeObjectURL(url);
  });
  Object.keys(audioCache).forEach(key => {
    delete audioCache[key];
  });
};
