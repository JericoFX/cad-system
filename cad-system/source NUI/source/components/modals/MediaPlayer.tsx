import { Show, createSignal, onMount, onCleanup, createEffect } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { viewerState, viewerActions } from '~/stores/viewerStore';

export function MediaPlayer() {
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [currentTime, setCurrentTime] = createSignal(0);
  const [duration, setDuration] = createSignal(0);
  const [volume, setVolume] = createSignal(75);
  const [isLooping, setIsLooping] = createSignal(false);
  const [isDragging, setIsDragging] = createSignal(false);
  const [isVolumeDragging, setIsVolumeDragging] = createSignal(false);

  let videoRef: HTMLVideoElement | undefined;
  let audioRef: HTMLAudioElement | undefined;
  let progressInterval: ReturnType<typeof setInterval> | undefined;
  let progressBarRef: HTMLDivElement | undefined;
  let volumeBarRef: HTMLDivElement | undefined;

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClose = () => {
    if (progressInterval) {
      clearInterval(progressInterval);
    }
    // Stop media playback
    const media = videoRef || audioRef;
    if (media) {
      media.pause();
      media.currentTime = 0;
    }
    terminalActions.setActiveModal(null);
    viewerActions.close();
  };

  const togglePlay = () => {
    const media = videoRef || audioRef;
    if (!media) return;

    if (isPlaying()) {
      media.pause();
    } else {
      media.play().catch(err => {
        console.error('[MediaPlayer] Playback error:', err);
      });
    }
  };

  const seekToTime = (time: number) => {
    const media = videoRef || audioRef;
    if (!media) return;
    const clampedTime = Math.max(0, Math.min(time, duration() || 0));
    media.currentTime = clampedTime;
    setCurrentTime(clampedTime);
  };

  const seekRelative = (seconds: number) => {
    seekToTime(currentTime() + seconds);
  };

  const toggleLoop = () => {
    const media = videoRef || audioRef;
    if (!media) return;
    const newLoop = !isLooping();
    media.loop = newLoop;
    setIsLooping(newLoop);
  };

  const handleProgressBarClick = (e: MouseEvent) => {
    if (!progressBarRef) return;
    const rect = progressBarRef.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    seekToTime(percent * (duration() || 0));
  };

  const handleProgressBarMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    handleProgressBarClick(e);
  };

  const handleProgressBarMouseMove = (e: MouseEvent) => {
    if (!isDragging()) return;
    e.preventDefault();
    handleProgressBarClick(e);
  };

  const handleProgressBarMouseUp = () => {
    setIsDragging(false);
  };

  const handleVolumeClick = (e: MouseEvent) => {
    if (!volumeBarRef) return;
    const rect = volumeBarRef.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newVolume = Math.round(percent * 100);
    setVolume(newVolume);
    const media = videoRef || audioRef;
    if (media) {
      media.volume = newVolume / 100;
    }
  };

  const handleVolumeMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    setIsVolumeDragging(true);
    handleVolumeClick(e);
  };

  const handleVolumeMouseMove = (e: MouseEvent) => {
    if (!isVolumeDragging()) return;
    e.preventDefault();
    handleVolumeClick(e);
  };

  const handleVolumeMouseUp = () => {
    setIsVolumeDragging(false);
  };

  createEffect(() => {
    if (isDragging() || isVolumeDragging()) {
      window.addEventListener('mousemove', handleProgressBarMouseMove);
      window.addEventListener('mousemove', handleVolumeMouseMove);
      window.addEventListener('mouseup', handleProgressBarMouseUp);
      window.addEventListener('mouseup', handleVolumeMouseUp);
    } else {
      window.removeEventListener('mousemove', handleProgressBarMouseMove);
      window.removeEventListener('mousemove', handleVolumeMouseMove);
      window.removeEventListener('mouseup', handleProgressBarMouseUp);
      window.removeEventListener('mouseup', handleVolumeMouseUp);
    }
  });

  onMount(() => {
    console.log('[MediaPlayer] Mounted:', {
      mediaType: viewerState.mediaType,
      mediaUrl: viewerState.mediaUrl
    });

    // Initialize volume
    const media = videoRef || audioRef;
    if (media) {
      media.volume = volume() / 100;
    }

    progressInterval = setInterval(() => {
      const media = videoRef || audioRef;
      if (media) {
        setCurrentTime(media.currentTime);
        if (media.duration && !isNaN(media.duration)) {
          setDuration(media.duration);
        }
      }
    }, 100);
  });

  onCleanup(() => {
    if (progressInterval) {
      clearInterval(progressInterval);
    }
    window.removeEventListener('mousemove', handleProgressBarMouseMove);
    window.removeEventListener('mousemove', handleVolumeMouseMove);
    window.removeEventListener('mouseup', handleProgressBarMouseUp);
    window.removeEventListener('mouseup', handleVolumeMouseUp);
  });

  const getProgressPercent = () => {
    if (duration() <= 0) return 0;
    return (currentTime() / duration()) * 100;
  };

  const getVolumePercent = () => {
    return volume();
  };

  return (
    <div 
      class="modal-overlay" 
      onClick={handleClose}
      style={{ 
        'background-color': 'rgba(0, 0, 0, 0.95)',
        display: 'flex',
        'align-items': 'center',
        'justify-content': 'center'
      }}
    >
      <Show 
        when={viewerState.mediaType === 'video'}
        fallback={
          // AUDIO PLAYER
          <div 
            class="modal-content audio-player" 
            onClick={(e) => e.stopPropagation()}
          >
            <div class="modal-header">
              <h2>{viewerState.title || 'AUDIO PLAYER'}</h2>
              <button class="modal-close" onClick={handleClose}>×</button>
            </div>

            <div class="audio-content">
              <div class="audio-icon">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
              </div>

              <audio
                ref={audioRef}
                src={viewerState.mediaUrl || ''}
                onEnded={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onVolumeChange={() => {
                  if (audioRef) {
                    setVolume(Math.round(audioRef.volume * 100));
                  }
                }}
                onLoadedMetadata={() => {
                  console.log('[MediaPlayer] Audio metadata loaded');
                  if (audioRef) {
                    audioRef.volume = volume() / 100;
                  }
                }}
                loop={isLooping()}
                preload="auto"
                crossorigin="anonymous"
              />

              {/* Progress Bar */}
              <div class="progress-container">
                <span class="time-display">{formatTime(currentTime())}</span>
                <div 
                  class="progress-bar-container"
                  ref={progressBarRef}
                  onMouseDown={handleProgressBarMouseDown}
                >
                  <div class="progress-bar-track">
                    <div 
                      class="progress-bar-fill"
                      style={{ width: `${getProgressPercent()}%` }}
                    />
                  </div>
                  <div 
                    class="progress-bar-handle"
                    style={{ left: `${getProgressPercent()}%` }}
                  />
                </div>
                <span class="time-display">{formatTime(duration())}</span>
              </div>

              {/* Controls */}
              <div class="audio-controls">
                <button class="control-btn" onClick={() => seekRelative(-10)} title="Rewind 10s">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/>
                  </svg>
                </button>
                
                <button class="control-btn play-btn" onClick={togglePlay} title={isPlaying() ? 'Pause' : 'Play'}>
                  {isPlaying() ? (
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                    </svg>
                  ) : (
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  )}
                </button>
                
                <button class="control-btn" onClick={() => seekRelative(10)} title="Forward 10s">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/>
                  </svg>
                </button>
                
                <button 
                  class={`control-btn ${isLooping() ? 'active' : ''}`} 
                  onClick={toggleLoop}
                  title="Loop"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
                  </svg>
                </button>
              </div>

              {/* Volume */}
              <div class="volume-container">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
                <div 
                  class="volume-bar-container"
                  ref={volumeBarRef}
                  onMouseDown={handleVolumeMouseDown}
                >
                  <div class="volume-bar-track">
                    <div 
                      class="volume-bar-fill"
                      style={{ width: `${getVolumePercent()}%` }}
                    />
                  </div>
                  <div 
                    class="volume-bar-handle"
                    style={{ left: `${getVolumePercent()}%` }}
                  />
                </div>
                <span class="volume-value">{volume()}%</span>
              </div>
            </div>

            <div class="modal-footer">
              <span class="footer-text">Audio playback</span>
              <button class="btn" onClick={handleClose}>Close</button>
            </div>
          </div>
        }
      >
        {/* VIDEO PLAYER - Fullscreen */}
        <div 
          class="modal-content video-player" 
          onClick={(e) => e.stopPropagation()}
        >
          <div class="video-header">
            <h2>{viewerState.title || 'VIDEO PLAYER'}</h2>
            <button class="modal-close" onClick={handleClose}>×</button>
          </div>

          <div class="video-container">
            <Show when={viewerState.mediaUrl} fallback={
              <div style={{ color: 'var(--terminal-error)', padding: '20px' }}>
                Error: No video URL provided
              </div>
            }>
              <video
                ref={videoRef}
                src={viewerState.mediaUrl || ''}
                controls
                playsinline
                preload="metadata"
                crossorigin="anonymous"
                onEnded={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onVolumeChange={() => {
                  if (videoRef) {
                    setVolume(Math.round(videoRef.volume * 100));
                  }
                }}
                onError={(e) => {
                  const video = e.target as HTMLVideoElement;
                  console.error('[MediaPlayer] Video error:', {
                    code: video.error?.code,
                    message: video.error?.message,
                    url: viewerState.mediaUrl,
                    networkState: video.networkState,
                    readyState: video.readyState
                  });
                }}
                onLoadedData={() => console.log('[MediaPlayer] Video loaded')}
                onCanPlay={() => console.log('[MediaPlayer] Video can play')}
                onLoadedMetadata={() => {
                  console.log('[MediaPlayer] Video metadata loaded');
                  if (videoRef) {
                    videoRef.volume = volume() / 100;
                  }
                }}
              />
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}
