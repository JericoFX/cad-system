import { createSignal, Show, createEffect, For, onMount } from 'solid-js';
import { userActions, userState } from '~/stores/userStore';
import { appActions } from '~/stores/appStore';
import { terminalActions } from '~/stores/terminalStore';
import { homeActions } from '~/stores/homeStore';

interface CallsignPromptProps {
  mode?: 'setup' | 'change';
}

export function CallsignPrompt(props: CallsignPromptProps) {
  const [input, setInput] = createSignal(userState.callsign || '');
  const [error, setError] = createSignal<string | null>(null);
  const [isValid, setIsValid] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);
  const [warning, setWarning] = createSignal<string | null>(null);

  // Validate on input change
  createEffect(() => {
    const value = input();
    if (!value) {
      setError(null);
      setIsValid(false);
      setWarning(null);
      return;
    }

    const normalized = userActions.normalizeCallsign(value);
    const result = userActions.validateCallsign(normalized);
    
    setIsValid(result.valid);
    setError(result.valid ? null : result.error || null);
    
    // Check for common patterns and show preview
    if (result.valid) {
      setWarning(null);
    }
  });

  const handleInput = (e: Event) => {
    const target = e.target as HTMLInputElement;
    setInput(target.value);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    
    if (!isValid()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const normalized = userActions.normalizeCallsign(input());
    const result = await userActions.saveCallsign(normalized);

    setIsLoading(false);

    if (result.success) {
      // Close modal
      terminalActions.setActiveModal(null);
      
      // If in setup mode, initialize home screen
      if (props.mode !== 'change') {
        homeActions.init();
      }
    } else {
      setError(result.error || 'Error al guardar el callsign');
    }
  };

  const handleCancel = () => {
    // If in setup mode (no callsign), close the entire CAD
    if (props.mode !== 'change' && !userState.callsign) {
      appActions.hide();
      // Also notify server to close NUI focus
      fetch('https://cad-system/closeUI', {
        method: 'POST',
        body: '{}',
      }).catch(() => {});
    } else {
      // Just close the modal
      terminalActions.setActiveModal(null);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && isValid() && !isLoading()) {
      handleSubmit(e);
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const examples = [
    '1-ADAM-15',
    '2-K9-7',
    '3-LINCOLN-22',
    '1-DET-5',
  ];

  return (
    <div class="modal-overlay" onKeyDown={handleKeyDown}>
      <div class="callsign-prompt-modal">
        <div class="callsign-header">
          <div class="callsign-icon">🎯</div>
          <h2>
            {props.mode === 'change' ? 'CAMBIAR CALLSIGN' : 'ASIGNAR CALLSIGN'}
          </h2>
          <Show when={props.mode !== 'change'}>
            <p class="callsign-subtitle">
              Tu identificación en el sistema de radio
            </p>
          </Show>
        </div>

        <form class="callsign-form" onSubmit={handleSubmit}>
          <div class="callsign-input-group">
            <label for="callsign-input">Callsign</label>
            <input
              id="callsign-input"
              type="text"
              value={input()}
              onInput={handleInput}
              placeholder="1-ADAM-15"
              classList={{
                'callsign-input': true,
                'callsign-input--error': error() && input().length > 0,
                'callsign-input--valid': isValid(),
              }}
              disabled={isLoading()}
              autofocus
              maxlength={20}
              autocomplete="off"
              spellcheck={false}
            />
            <Show when={input() && !isValid()}>
              <span class="callsign-error">{error()}</span>
            </Show>
            <Show when={warning()}>
              <span class="callsign-warning">{warning()}</span>
            </Show>
          </div>

          <div class="callsign-examples">
            <span class="examples-label">Ejemplos:</span>
            <div class="examples-list">
              <For each={examples}>
                {(example) => (
                  <button
                    type="button"
                    class="example-btn"
                    onClick={() => setInput(example)}
                    disabled={isLoading()}
                  >
                    {example}
                  </button>
                )}
              </For>
            </div>
          </div>

          <div class="callsign-format-info">
            <span class="format-label">Formato:</span>
            <code class="format-code">[División]-[Código]-[Número]</code>
            <span class="format-example">ej: 1-ADAM-15</span>
          </div>

          <div class="callsign-actions">
            <button
              type="button"
              class="btn btn-secondary"
              onClick={handleCancel}
              disabled={isLoading()}
            >
              {props.mode === 'change' ? 'Cancelar' : 'Cerrar CAD'}
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              disabled={!isValid() || isLoading()}
            >
              {isLoading() ? 'Guardando...' : 'Confirmar'}
            </button>
          </div>
        </form>

        <Show when={props.mode !== 'change'}>
          <div class="callsign-footer">
            <p>
              El callsign es tu identificación única en el sistema.
              <br />
              Lo usarán otras unidades para comunicarse contigo.
            </p>
          </div>
        </Show>
      </div>
    </div>
  );
}
