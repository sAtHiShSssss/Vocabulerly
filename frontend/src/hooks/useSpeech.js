import { useCallback, useRef, useEffect, useState } from 'react';

// Ranked preferences for high-quality English voices
const PREFERRED_VOICES = [
  'Google UK English Female',
  'Google UK English Male',
  'Google US English',
  'Microsoft Zira',
  'Microsoft David',
  'Samantha', // macOS
  'Daniel',   // macOS UK
  'Karen',    // macOS AU
  'Moira',    // macOS IE
  'Tessa',    // macOS ZA
  'Alex',     // macOS
];

function pickBestVoice(voices) {
  if (!voices || voices.length === 0) return null;

  // 1. Try preferred voices by name (partial match)
  for (const pref of PREFERRED_VOICES) {
    const found = voices.find(v => v.name.includes(pref) && v.lang.startsWith('en'));
    if (found) return found;
  }

  // 2. Prefer any "enhanced" or "premium" English voice
  const enhanced = voices.find(
    v => v.lang.startsWith('en') && /enhanced|premium|natural|neural/i.test(v.name)
  );
  if (enhanced) return enhanced;

  // 3. Any English voice that isn't "compact"
  const english = voices.filter(v => v.lang.startsWith('en'));
  const nonCompact = english.find(v => !/compact/i.test(v.name));
  if (nonCompact) return nonCompact;

  // 4. Fallback to first English voice
  return english[0] || voices[0];
}

// Audio cache for dictionary pronunciations
const audioCache = new Map();

export function useSpeech() {
  const [voices, setVoices] = useState([]);
  const bestVoiceRef = useRef(null);
  const audioRef = useRef(null);

  // Load voices (they may load async in some browsers)
  useEffect(() => {
    const loadVoices = () => {
      const available = speechSynthesis.getVoices();
      if (available.length > 0) {
        setVoices(available);
        bestVoiceRef.current = pickBestVoice(available);
      }
    };

    if ('speechSynthesis' in window) {
      loadVoices();
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if ('speechSynthesis' in window) {
        speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const speak = useCallback((text, rate = 0.85) => {
    if (!text) return;

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const word = text.trim().toLowerCase();

    // Try to use the Free Dictionary API audio first (real human pronunciation)
    const tryDictionaryAudio = () => {
      return new Promise((resolve) => {
        // Check cache
        if (audioCache.has(word)) {
          const url = audioCache.get(word);
          if (url) {
            const audio = new Audio(url);
            audio.volume = 1.0;
            audioRef.current = audio;
            audio.play().then(() => resolve(true)).catch(() => resolve(false));
          } else {
            resolve(false);
          }
          return;
        }

        // Only fetch for single words (phrases use TTS directly)
        if (word.includes(' ') || word.length > 30) {
          audioCache.set(word, null);
          resolve(false);
          return;
        }

        fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`)
          .then(r => r.ok ? r.json() : Promise.reject())
          .then(data => {
            // Find the best audio URL from phonetics
            let audioUrl = null;
            for (const entry of data) {
              if (entry.phonetics) {
                for (const p of entry.phonetics) {
                  if (p.audio && p.audio.length > 0) {
                    // Prefer US pronunciation
                    if (p.audio.includes('-us') || p.audio.includes('_us')) {
                      audioUrl = p.audio;
                      break;
                    }
                    if (!audioUrl) audioUrl = p.audio;
                  }
                }
              }
              if (audioUrl && audioUrl.includes('-us')) break;
            }

            audioCache.set(word, audioUrl);
            if (audioUrl) {
              const audio = new Audio(audioUrl);
              audio.volume = 1.0;
              audioRef.current = audio;
              audio.play().then(() => resolve(true)).catch(() => resolve(false));
            } else {
              resolve(false);
            }
          })
          .catch(() => {
            audioCache.set(word, null);
            resolve(false);
          });
      });
    };

    // Fallback: use browser TTS with the best voice
    const useTTS = () => {
      if (!('speechSynthesis' in window)) return;
      speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = rate;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      if (bestVoiceRef.current) {
        utterance.voice = bestVoiceRef.current;
        utterance.lang = bestVoiceRef.current.lang;
      }

      speechSynthesis.speak(utterance);
    };

    // Try dictionary audio first, fall back to TTS
    tryDictionaryAudio().then(success => {
      if (!success) useTTS();
    });
  }, [voices]);

  return speak;
}
