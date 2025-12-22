import { useEffect, useState, useRef, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents, AvatarMessage } from '../../types';

interface AvatarProps {
  socket?: Socket<ServerToClientEvents, ClientToServerEvents> | null;
}

type Emotion = 'neutral' | 'happy' | 'excited' | 'thinking';

/**
 * Avatar Host Component
 *
 * Displays an animated avatar in the corner of the TV screen.
 * Listens for 'avatar:speak' events and uses text-to-speech to announce messages.
 */
function Avatar({ socket }: AvatarProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentText, setCurrentText] = useState<string>('');
  const [emotion, setEmotion] = useState<Emotion>('neutral');
  const [isVisible, setIsVisible] = useState(false);
  const speechQueue = useRef<AvatarMessage[]>([]);
  const isSpeakingRef = useRef(false);

  // Process speech queue
  const processQueue = useCallback(() => {
    if (isSpeakingRef.current || speechQueue.current.length === 0) {
      return;
    }

    const message = speechQueue.current.shift();
    if (!message) return;

    isSpeakingRef.current = true;
    setIsSpeaking(true);
    setCurrentText(message.text);
    setEmotion(message.emotion || 'neutral');
    setIsVisible(true);

    // Use Web Speech API
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(message.text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Try to select a good voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(
        (v) => v.lang.startsWith('en') && v.name.includes('Google')
      ) || voices.find((v) => v.lang.startsWith('en'));

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onend = () => {
        isSpeakingRef.current = false;
        setIsSpeaking(false);

        // Keep visible for a moment after speaking
        setTimeout(() => {
          if (!isSpeakingRef.current && speechQueue.current.length === 0) {
            setIsVisible(false);
            setCurrentText('');
          }
          // Process next in queue
          processQueue();
        }, 1500);
      };

      utterance.onerror = () => {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        setIsVisible(false);
        setCurrentText('');
        processQueue();
      };

      window.speechSynthesis.speak(utterance);
    } else {
      // No speech synthesis available, just show text
      setTimeout(() => {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        setTimeout(() => {
          if (!isSpeakingRef.current && speechQueue.current.length === 0) {
            setIsVisible(false);
            setCurrentText('');
          }
          processQueue();
        }, 1500);
      }, 2000);
    }
  }, []);

  // Listen for avatar:speak events
  useEffect(() => {
    if (!socket) return;

    const handleSpeak = (message: AvatarMessage) => {
      console.log('[Avatar] Received speak event:', message);
      speechQueue.current.push(message);
      processQueue();
    };

    socket.on('avatar:speak', handleSpeak);

    // Load voices (needed for some browsers)
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }

    return () => {
      socket.off('avatar:speak', handleSpeak);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [socket, processQueue]);

  // Get emoji based on emotion
  const getEmoji = (emo: Emotion): string => {
    switch (emo) {
      case 'happy':
        return '\u{1F60A}';
      case 'excited':
        return '\u{1F389}';
      case 'thinking':
        return '\u{1F914}';
      default:
        return '\u{1F3AE}';
    }
  };

  // Animation class based on state
  const getAnimationClass = (): string => {
    if (isSpeaking) {
      return 'animate-bounce';
    }
    return '';
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '1rem',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-end',
        gap: '0.75rem',
        maxWidth: '400px',
      }}
    >
      {/* Avatar character */}
      <div
        className={getAnimationClass()}
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.8) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '40px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          border: '4px solid hsl(var(--background))',
          flexShrink: 0,
        }}
      >
        {getEmoji(emotion)}
      </div>

      {/* Speech bubble */}
      {currentText && (
        <div
          style={{
            background: 'hsl(var(--card))',
            borderRadius: '1rem',
            padding: '0.75rem 1rem',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            border: '3px solid hsl(var(--border))',
            position: 'relative',
            animation: 'fadeIn 0.3s ease-out',
          }}
        >
          {/* Speech bubble tail */}
          <div
            style={{
              position: 'absolute',
              left: '-10px',
              bottom: '20px',
              width: 0,
              height: 0,
              borderTop: '10px solid transparent',
              borderBottom: '10px solid transparent',
              borderRight: '10px solid hsl(var(--card))',
            }}
          />
          <p
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 600,
              color: 'hsl(var(--foreground))',
              lineHeight: 1.4,
            }}
          >
            {currentText}
          </p>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default Avatar;
