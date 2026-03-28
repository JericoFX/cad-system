import { Show, createSignal, onMount, onCleanup, createEffect } from 'solid-js';
import { viewerState, viewerActions } from '~/stores/viewerStore';
import { Button, Modal } from '~/components/ui';

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
    const media = videoRef || audioRef;
    if (media) {
      media.pause();
      media.currentTime = 0;
    }
    viewerActions.close();
  };

  const togglePlay = () => {
    const media = videoRef || audioRef;
    if (!media) return;

    if (isPlaying()) {
      media.pause();
    } else {
      media.play().catch((err) => {
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
    const dur = duration();
    if (dur <= 0 || !isFinite(dur)) return 0;
    const percent = (currentTime() / dur) * 100;
    return Math.min(100, Math.max(0, percent));
  };

  const renderControls = () => (
    <>
      <div class='progress-container'>
        <span class='time-display'>{formatTime(currentTime())}</span>
        <div
          class='progress-bar-container'
          ref={progressBarRef}
          onMouseDown={handleProgressBarMouseDown}
        >
          <div class='progress-bar-track'>
            <div
              class='progress-bar-fill'
              style={{ width: `${getProgressPercent()}%` }}
            />
          </div>
        </div>
        <span class='time-display'>{formatTime(duration())}</span>
      </div>

      <div class='media-controls'>
        <Button.Root class='btn' onClick={() => seekRelative(-10)}>
          {'[<<]'}
        </Button.Root>
        <Button.Root class='btn btn-primary' onClick={togglePlay}>
          {isPlaying() ? '[||]' : '[>]'}
        </Button.Root>
        <Button.Root class='btn' onClick={() => seekRelative(10)}>
          {'[>>]'}
        </Button.Root>
        <button
          class={`btn ${isLooping() ? 'btn-primary' : ''}`}
          onClick={toggleLoop}
        >
          [R]
        </button>
      </div>

      <div class='volume-container'>
        <span>VOL:</span>
        <div
          class='progress-bar-container'
          ref={volumeBarRef}
          onMouseDown={handleVolumeMouseDown}
          style={{ width: '120px' }}
        >
          <div class='progress-bar-track'>
            <div class='progress-bar-fill' style={{ width: `${volume()}% ` }} />
          </div>
        </div>
        <span>{volume()}%</span>
      </div>
    </>
  );

  return (
    <Modal.Root onClose={handleClose} useContentWrapper={false}>
      <Show
        when={viewerState.mediaType === 'video'}
        fallback={
          <div
            class='modal-content'
            onClick={(e) => e.stopPropagation()}
            style={{ width: '600px' }}
          >
            <div class='modal-header'>
              <h2>{viewerState.title || 'AUDIO PLAYER'}</h2>
              <button class='modal-close' onClick={handleClose}>
                [X]
              </button>
            </div>

            <div
              style={{
                padding: '20px',
                display: 'flex',
                'flex-direction': 'column',
                'align-items': 'center',
                gap: '15px',
              }}
            >
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
                  if (audioRef) {
                    audioRef.volume = volume() / 100;
                  }
                }}
                onError={(e) => {
                  const audio = e.target as HTMLAudioElement;
                  console.error(
                    '[MediaPlayer] Audio error:',
                    audio.error?.message,
                  );
                }}
                loop={isLooping()}
                preload='auto'
              />

              {renderControls()}
            </div>

            <div class='modal-footer'>
              <Button.Root class='btn' onClick={handleClose}>
                [CLOSE]
              </Button.Root>
            </div>
          </div>
        }
      >
        <div
          class='modal-content'
          onClick={(e) => e.stopPropagation()}
          style={{ width: '900px', height: '680px' }}
        >
          <div class='modal-header'>
            <h2>{viewerState.title || 'VIDEO PLAYER'}</h2>
            <button class='modal-close' onClick={handleClose}>
              [X]
            </button>
          </div>

          <div
            style={{
              flex: 1,
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              'background-color': 'black',
            }}
          >
            <video
              ref={videoRef}
              src={viewerState.mediaUrl || ''}
              playsinline
              preload='metadata'
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
                console.error(
                  '[MediaPlayer] Video error:',
                  video.error?.message,
                );
              }}
              onLoadedMetadata={() => {
                if (videoRef) {
                  videoRef.volume = volume() / 100;
                }
              }}
              style={{
                'max-width': '100%',
                'max-height': '100%',
                'object-fit': 'contain',
              }}
            />
          </div>

          <div
            style={{
              padding: '15px',
              display: 'flex',
              'flex-direction': 'column',
              'align-items': 'center',
              gap: '10px',
              'border-top': '2px solid var(--terminal-border)',
            }}
          >
            {renderControls()}
          </div>

          <div class='modal-footer'>
            <Button.Root class='btn' onClick={handleClose}>
              [CLOSE]
            </Button.Root>
          </div>
        </div>
      </Show>
    </Modal.Root>
  );
}
