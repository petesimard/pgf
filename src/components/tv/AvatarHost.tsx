import { useEffect, useState, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '../../types';
import './AvatarHost.css';

interface AvatarHostProps {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
}

interface SpeechState {
  messageId: string;
  text: string;
  audioChunks: Uint8Array[];
  isPlaying: boolean;
  isComplete: boolean;
  showBubble: boolean;
}

function AvatarHost({ socket }: AvatarHostProps) {
  const [currentSpeech, setCurrentSpeech] = useState<SpeechState | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const currentMessageIdRef = useRef<string | null>(null);
  const fadeTimeoutRef = useRef<number | null>(null);
  const currentBlobUrlRef = useRef<string | null>(null);
  const isAudioPlayingRef = useRef(false);
  const hasStartedPlayingRef = useRef<string | null>(null); // Track which messageId has started playing

  // Initialize audio element
  useEffect(() => {
    audioElementRef.current = new Audio();
    audioElementRef.current.preload = 'auto';

    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.src = '';
      }
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
      }
    };
  }, []);

  // Cancel current speech
  const cancelCurrentSpeech = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    if (currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
    }
    currentMessageIdRef.current = null;
    isAudioPlayingRef.current = false;
    hasStartedPlayingRef.current = null;
  };

  // Schedule fade-out
  const scheduleFadeOut = (delay: number) => {
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
    }

    fadeTimeoutRef.current = window.setTimeout(() => {
      setIsFadingOut(true);
      setTimeout(() => {
        setIsVisible(false);
        setCurrentSpeech(null);
        setIsFadingOut(false);
        currentMessageIdRef.current = null;
      }, 1000); // Match CSS transition duration
    }, delay);
  };

  // Play complete audio from accumulated chunks
  const playAudio = (chunks: Uint8Array[]) => {
    if (!audioElementRef.current || chunks.length === 0) return;

    try {
      // Concatenate all chunks into a single Uint8Array
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const completeAudio = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        completeAudio.set(chunk, offset);
        offset += chunk.length;
      }

      // Create blob and URL
      const blob = new Blob([completeAudio], { type: 'audio/mpeg' });

      // Revoke old blob URL if exists
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
      }

      const url = URL.createObjectURL(blob);
      currentBlobUrlRef.current = url;

      // Set up audio element
      const audio = audioElementRef.current;
      audio.src = url;

      // Set up event handlers before playing
      audio.onended = () => {
        console.log('[AvatarHost] Audio playback completed');
        isAudioPlayingRef.current = false;
        scheduleFadeOut(1000); // Wait 1 second after audio ends before fading
      };

      audio.onerror = (e) => {
        console.error('[AvatarHost] Audio playback error:', e);
        isAudioPlayingRef.current = false;
        scheduleFadeOut(5000); // Text-only mode, fade after 5 seconds
      };

      audio.onloadeddata = () => {
        console.log('[AvatarHost] Audio loaded, duration:', audio.duration, 'seconds');
      };

      audio.onplay = () => {
        console.log('[AvatarHost] Audio started playing');
        isAudioPlayingRef.current = true;
      };

      audio.onpause = () => {
        console.log('[AvatarHost] Audio paused');
      };

      // Play audio
      audio.play()
        .then(() => {
          console.log('[AvatarHost] Audio play() promise resolved');
          setCurrentSpeech((prev) => (prev ? { ...prev, isPlaying: true } : null));
        })
        .catch((error) => {
          console.error('[AvatarHost] Failed to play audio:', error);
          isAudioPlayingRef.current = false;
          // Text-only mode: still show text but fade after 5 seconds
          scheduleFadeOut(5000);
        });
    } catch (error) {
      console.error('[AvatarHost] Failed to create audio blob:', error);
      scheduleFadeOut(5000);
    }
  };

  // Socket event handlers
  useEffect(() => {
    if (!socket) return;

    const handleSpeakStart = (data: { messageId: string; text: string; showBubble?: boolean }) => {
      console.log('[AvatarHost] Speech started:', data);

      // Cancel current speech if exists
      if (currentMessageIdRef.current) {
        cancelCurrentSpeech();
      }

      currentMessageIdRef.current = data.messageId;
      setCurrentSpeech({
        messageId: data.messageId,
        text: data.text,
        audioChunks: [],
        isPlaying: false,
        isComplete: false,
        showBubble: data.showBubble ?? true, // Default to true if not specified
      });
      setIsVisible(true);
      setIsFadingOut(false);

      // Clear any pending fade-out
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
        fadeTimeoutRef.current = null;
      }
    };

    const handleAudioChunk = (data: {
      messageId: string;
      audioChunk: string;
      isLast: boolean;
    }) => {
      // Ignore if message was cancelled
      if (data.messageId !== currentMessageIdRef.current) {
        console.log('[AvatarHost] Ignoring chunk from cancelled message');
        return;
      }

      if (data.isLast) {
        // All chunks received, mark as complete and play audio
        setCurrentSpeech((prev) => {
          if (prev && hasStartedPlayingRef.current !== data.messageId) {
            // Only play audio once per message
            hasStartedPlayingRef.current = data.messageId;
            const chunks = prev.audioChunks;
            // Use setTimeout to ensure state update completes before playAudio
            setTimeout(() => playAudio(chunks), 0);
            return { ...prev, isComplete: true };
          }
          return prev ? { ...prev, isComplete: true } : null;
        });
      } else if (data.audioChunk) {
        // Convert base64 to Uint8Array and accumulate
        const binaryString = atob(data.audioChunk);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        setCurrentSpeech((prev) =>
          prev
            ? {
                ...prev,
                audioChunks: [...prev.audioChunks, bytes],
              }
            : null
        );
      }
    };

    const handleSpeakEnd = (data: { messageId: string }) => {
      if (data.messageId !== currentMessageIdRef.current) return;
      console.log('[AvatarHost] Speech ended');
      // Fade-out will be triggered after audio finishes playing
    };

    const handleSpeakError = (data: { messageId: string; error: string }) => {
      if (data.messageId !== currentMessageIdRef.current) return;
      console.error('[AvatarHost] Speech error:', data.error);

      // Show text-only mode (no audio)
      // Avatar will still show text and fade after 5 seconds
      if (currentSpeech) {
        scheduleFadeOut(5000);
      }
    };

    socket.on('host:speak-start', handleSpeakStart);
    socket.on('host:audio-chunk', handleAudioChunk);
    socket.on('host:speak-end', handleSpeakEnd);
    socket.on('host:speak-error', handleSpeakError);

    return () => {
      socket.off('host:speak-start', handleSpeakStart);
      socket.off('host:audio-chunk', handleAudioChunk);
      socket.off('host:speak-end', handleSpeakEnd);
      socket.off('host:speak-error', handleSpeakError);
    };
  }, [socket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, []);

  if (!isVisible || !currentSpeech) {
    return null;
  }

  return (
    <div className={`avatar-host ${isFadingOut ? 'fade-out' : ''}`}>
      <div className="avatar-container">
        <img
          src="/assets/images/avatar.png"
          alt="Game Host Avatar"
          className="avatar-image"
        />
      </div>
      {currentSpeech.showBubble && (
        <div className="speech-bubble">
          <div className="speech-text">{currentSpeech.text}</div>
        </div>
      )}
    </div>
  );
}

export default AvatarHost;
