
import { Show, For, onMount, onCleanup } from 'solid-js';
import { suggestionsState, suggestionsActions } from '~/stores/suggestionsStore';
import { registry } from '~/commands/registry';

export function CommandSuggestions() {
  let containerRef: HTMLDivElement | undefined;

  const runCommand = (command: string) => {
    suggestionsActions.hide();
    registry.execute(command);
  };

  const dismiss = (e: Event) => {
    e.stopPropagation();
    suggestionsActions.hide();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && suggestionsState.isVisible) {
      e.preventDefault();
      suggestionsActions.hide();
    }
    
    if (suggestionsState.isVisible && /^[1-9]$/.test(e.key)) {
      const index = parseInt(e.key) - 1;
      const suggestion = suggestionsState.suggestions[index];
      if (suggestion) {
        e.preventDefault();
        runCommand(suggestion.command);
      }
    }
  };

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <Show when={suggestionsState.isVisible && suggestionsState.suggestions.length > 0}>
      <div 
        ref={containerRef}
        class={`command-suggestions ${suggestionsState.suggestions[0]?.type === 'error' ? 'error-suggestions' : ''}`}
      >
        <div class="suggestions-header">
          <span class="suggestions-label">
            {suggestionsState.suggestions[0]?.type === 'error' 
              ? 'Did you mean?' 
              : 'Suggested next steps:'}
          </span>
          <button class="suggestions-dismiss" onClick={dismiss} title="Dismiss (ESC)">
            ×
          </button>
        </div>
        
        <div class="suggestions-list">
          <For each={suggestionsState.suggestions}>
            {(suggestion, index) => (
              <button
                class="suggestion-chip"
                onClick={() => runCommand(suggestion.command)}
                title={suggestion.description}
              >
                <span class="suggestion-number">[{index() + 1}]</span>
                <span class="suggestion-command">{suggestion.command}</span>
                <span class="suggestion-desc">- {suggestion.description}</span>
              </button>
            )}
          </For>
        </div>
        
        <div class="suggestions-footer">
          <span>Press number to run • ESC to dismiss</span>
        </div>
      </div>
    </Show>
  );
}
