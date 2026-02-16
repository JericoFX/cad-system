import { Show, createSignal, onMount, onCleanup } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { viewerState, viewerActions } from '~/stores/viewerStore';

export function MediaPlayer() {
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [currentTime, setCurrentTime] = createSignal(0);
  const [duration, setDuration] = createSignal(0);
  const [volume, setVolume] = createSignal(75);
  const [isLooping, setIsLooping] = createSignal(false);

  let videoRef: HTMLVideoElement | undefined;
  let audioRef: HTMLAudioElement | undefined;
  let progressInterval: ReturnType<typeof setInterval> | undefined;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressBar = (current: number, total: number): string => {
    const width = 40;
    const filled = Math.floor((current / total) * width);
    const empty = width - filled;
    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
  };

  const handleClose = () => {
    if (progressInterval) {
      clearInterval(progressInterval);
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
      media.play();
    }
    setIsPlaying(!isPlaying());
  };

  const seek = (seconds: number) => {
    const media = videoRef || audioRef;
    if (!media) return;
    media.currentTime = Math.max(0, Math.min(media.currentTime + seconds, duration()));
  };

  const seekToStart = () => {
    const media = videoRef || audioRef;
    if (!media) return;
    media.currentTime = 0;
  };

  const seekToEnd = () => {
    const media = videoRef || audioRef;
    if (!media) return;
    media.currentTime = duration();
  };

  const toggleLoop = () => {
    const media = videoRef || audioRef;
    if (!media) return;
    media.loop = !isLooping();
    setIsLooping(!isLooping());
  };

  const handleVolumeChange = (delta: number) => {
    const media = videoRef || audioRef;
    if (!media) return;
    const newVolume = Math.max(0, Math.min(100, volume() + delta));
    media.volume = newVolume / 100;
    setVolume(newVolume);
  };

  onMount(() => {
    console.log('[MediaPlayer] Mounted with mediaType:', viewerState.mediaType, 'mediaUrl:', viewerState.mediaUrl);
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
  });

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
          // AUDIO PLAYER - 800x600
          <div 
            class="modal-content" 
            onClick={(e) => e.stopPropagation()}
            style={{ 
              width: '800px',
              height: '600px',
              'max-width': '800px',
              'max-height': '600px',
              display: 'flex',
              'flex-direction': 'column',
              'background-color': 'var(--terminal-bg)',
              border: '2px solid var(--terminal-border)'
            }}
          >
            <div class="modal-header">
              <h2>
                {viewerState.title ? `=== ${viewerState.title} ===` : '=== AUDIO PLAYER ==='}
              </h2>
              <button class="modal-close" onClick={handleClose}>[X]</button>
            </div>

            <div style={{ 
              flex: 1,
              display: 'flex',
              'flex-direction': 'column',
              'align-items': 'center',
              'justify-content': 'center',
              padding: '40px',
              gap: '20px'
            }}>
              <div style={{ 
                'font-size': '48px',
                color: 'var(--terminal-system-bright)'
              }}>
                [AUDIO FILE]
              </div>

              <audio
                ref={audioRef}
                src={viewerState.mediaUrl || ''}
                onEnded={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                loop={isLooping()}
              />

              {/* Progress Bar TUI */}
              <div style={{ 
                'font-family': 'monospace',
                'font-size': '14px',
                color: 'var(--terminal-fg)',
                'white-space': 'pre'
              }}>
                {getProgressBar(currentTime(), duration() || 1)}
              </div>

              <div style={{ 
                'font-family': 'monospace',
                'font-size': '12px',
                color: 'var(--terminal-fg-dim)'
              }}>
                {formatTime(currentTime())} / {formatTime(duration())}
              </div>

              {/* Controls ASCII */}
              <div style={{ 
                display: 'flex',
                gap: '16px',
                'margin-top': '20px'
              }}>
                <button class="btn" onClick={seekToStart} title="Start">[|&lt;]</button>
                <button class="btn" onClick={() => seek(-10)} title="Rewind 10s">[&lt;&lt;]</button>
                <button class="btn btn-primary" onClick={togglePlay}>
                  {isPlaying() ? '[||]' : '[>] '}
                </button>
                <button class="btn" onClick={() => seek(10)} title="Forward 10s">[&gt;&gt;]</button>
                <button class="btn" onClick={seekToEnd} title="End">[&gt;|]</button>
                <button class="btn" onClick={toggleLoop} style={{ color: isLooping() ? 'var(--terminal-system)' : '' }}>[R]</button>
              </div>

              {/* Volume */}
              <div style={{ 
                display: 'flex',
                'align-items': 'center',
                gap: '10px',
                'margin-top': '20px'
              }}>
                <span style={{ 'font-size': '12px' }}>VOL:</span>
                <span style={{ 
                  'font-family': 'monospace',
                  'font-size': '12px'
                }}>
                  [{getProgressBar(volume(), 100).slice(1, -1)}]
                </span>
                <span style={{ 'font-size': '12px' }}>{volume()}%</span>
              </div>
            </div>

            <div class="modal-footer">
              <span style={{ color: '#808080', 'font-size': '12px' }}>
                Audio playback controls
              </span>
              <button class="btn" onClick={handleClose}>[CLOSE]</button>
            </div>
          </div>
        }
      >
        {/* VIDEO PLAYER - Fullscreen */}
        <div 
          class="modal-content" 
          onClick={(e) => e.stopPropagation()}
          style={{ 
            width: '100vw',
            height: '100vh',
            'max-width': '100vw',
            'max-height': '100vh',
            display: 'flex',
            'flex-direction': 'column',
            'background-color': 'black',
            border: 'none',
            padding: 0,
            position: 'relative'
          }}
        >
          <div class="modal-header" style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            'z-index': 100,
            'background-color': 'rgba(0, 0, 0, 0.8)',
            padding: '10px 20px'
          }}>
            <h2 style={{ margin: 0, 'font-size': '14px' }}>
              {viewerState.title ? `=== ${viewerState.title} ===` : '=== VIDEO PLAYER ==='}
            </h2>
            <button class="modal-close" onClick={handleClose} style={{ 'font-size': '14px' }}>[X]</button>
          </div>

          <div style={{
            flex: 1,
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            'background-color': 'black',
            'padding-top': '50px'
          }}>
            <video
              ref={videoRef}
              src={viewerState.mediaUrl || ''}
              controls
              autoplay
              playsinline
              preload="auto"
              style={{
                'max-width': '100%',
                'max-height': 'calc(100vh - 60px)',
                width: 'auto',
                height: 'auto'
              }}
              onEnded={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onError={(e) => console.error('[MediaPlayer] Video error:', e, 'URL:', viewerState.mediaUrl)}
              onLoadedData={() => console.log('[MediaPlayer] Video loaded successfully')}
            />
          </div>
        </div>
      </Show>
    </div>
  );
}
