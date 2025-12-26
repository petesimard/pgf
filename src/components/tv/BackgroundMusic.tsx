import { useEffect, useRef } from 'react';

interface BackgroundMusicProps {
  isSpeaking: boolean;
}

function BackgroundMusic({ isSpeaking }: BackgroundMusicProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const normalVolume = 0.4; // 30% volume normally
  const speakingVolume = 0.1; // 15% volume when avatar is speaking

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio('/assets/music/Playful LOOP.wav');
    audio.loop = true;
    audio.volume = normalVolume;
    audioRef.current = audio;

    // Start playing
    audio.play().catch((error) => {
      console.warn('[BackgroundMusic] Failed to autoplay (music file may not exist yet):', error);
    });

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Adjust volume based on speaking state
  useEffect(() => {
    if (!audioRef.current) return;

    const targetVolume = isSpeaking ? speakingVolume : normalVolume;

    // Smoothly transition volume over 300ms
    const startVolume = audioRef.current.volume;
    const volumeDiff = targetVolume - startVolume;
    const duration = 300; // ms
    const steps = 20;
    const stepDuration = duration / steps;
    const volumeStep = volumeDiff / steps;

    let currentStep = 0;
    const interval = setInterval(() => {
      if (!audioRef.current) {
        clearInterval(interval);
        return;
      }

      currentStep++;
      if (currentStep >= steps) {
        audioRef.current.volume = targetVolume;
        clearInterval(interval);
      } else {
        audioRef.current.volume = startVolume + (volumeStep * currentStep);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [isSpeaking]);

  return null; // No visual component
}

export default BackgroundMusic;
