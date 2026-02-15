import { For, onMount, onCleanup } from 'solid-js';
import { hackerState, hackerEffects } from '~/stores/hackerStore';

export function BackgroundTerminal() {
  let terminalRef: HTMLDivElement | undefined;

  onMount(() => {
    // Start background noise
    hackerEffects.startNoise(4000);
    
    // Initial burst of activity
    setTimeout(() => {
      hackerEffects.burst(3);
    }, 500);
  });

  onCleanup(() => {
    hackerEffects.stopNoise();
  });

  const getLineClass = (type: string) => {
    switch (type) {
      case 'command':
        return 'hacker-line--command';
      case 'error':
        return 'hacker-line--error';
      case 'system':
        return 'hacker-line--system';
      default:
        return 'hacker-line--output';
    }
  };

  return (
    <div class="hacker-background">
      <div class="hacker-terminal" ref={terminalRef}>
        <div class="hacker-lines">
          <For each={hackerState.lines}>
            {(line) => (
              <div class={`hacker-line ${getLineClass(line.type)}`}>
                <pre class="hacker-content">{line.content}</pre>
              </div>
            )}
          </For>
        </div>
      </div>
      
      {/* CRT scanline effect overlay */}
      <div class="hacker-scanlines" />
      
      {/* Subtle glow effect */}
      <div class="hacker-glow" />
    </div>
  );
}
