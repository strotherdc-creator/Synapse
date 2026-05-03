import { useCallback, useEffect, useRef, useState } from "react";

// Extend Window for vendor-prefixed SpeechRecognition
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  const w = window as unknown as Record<string, unknown>;
  return (
    (w.SpeechRecognition as SpeechRecognitionConstructor) ??
    (w.webkitSpeechRecognition as SpeechRecognitionConstructor) ??
    null
  );
}

/**
 * Speech-to-text hook using the Web Speech API.
 *
 * Uses continuous mode but tracks results properly using resultIndex
 * to avoid re-reading old results. Returns the full accumulated text
 * and current interim text separately.
 *
 * The consumer should use `fullTranscript` directly as the accumulated
 * final text (NOT append it). `interimText` is the current in-progress
 * recognition that hasn't been finalized yet.
 */
export function useSpeechToText() {
  const [isListening, setIsListening] = useState(false);
  const [fullTranscript, setFullTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [isSupported] = useState(() => getSpeechRecognition() !== null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  // Track how many results we've already processed as final
  const processedCountRef = useRef(0);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    // Stop any existing instance
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    processedCountRef.current = 0;
    setFullTranscript("");
    setInterimText("");

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let newFinals = "";
      let currentInterim = "";

      // Only process from resultIndex onward to avoid re-reading old results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          newFinals += result[0].transcript;
        } else {
          currentInterim += result[0].transcript;
        }
      }

      // Append only genuinely new final text
      if (newFinals) {
        setFullTranscript((prev) => {
          const separator = prev && !prev.endsWith(" ") ? " " : "";
          return prev + separator + newFinals.trim();
        });
      }

      setInterimText(currentInterim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "aborted" is expected when we call stop/abort
      if (event.error !== "aborted") {
        console.warn("[Speech recognition error]", event.error);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText("");
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Reset accumulated transcript (call when committing text to input)
  const resetTranscript = useCallback(() => {
    setFullTranscript("");
    setInterimText("");
  }, []);

  return {
    isListening,
    /** Accumulated final transcript text from this listening session */
    fullTranscript,
    /** Current interim (in-progress) recognition text */
    interimText,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
  };
}
