
import { For, Show, createMemo } from 'solid-js';
import { flowState, flowMacrosActions, type FlowMacro } from '~/stores/flowMacrosStore';

export function FlowMacros() {
  const macros = createMemo(() => flowMacrosActions.getAllMacros());
  const categories = createMemo(() => {
    const cats = new Set(macros().map((m) => m.category));
    return Array.from(cats);
  });

  const getCategoryLabel = (cat: FlowMacro['category']) => {
    const labels: Record<string, string> = {
      incident: '🚨 Incidents',
      arrest: '⛓️ Arrests',
      evidence: '📎 Evidence',
      dispatch: '📡 Dispatch',
    };
    return labels[cat] || cat;
  };

  return (
    <div class="flow-macros-panel">
      <h2 class="panel-title">Workflow Macros</h2>
      <p class="panel-subtitle">One-click guided workflows</p>

      <div class="flow-categories">
        <For each={categories()}>
          {(category) => (
            <div class="flow-category">
              <h3>{getCategoryLabel(category)}</h3>
              <div class="flow-macros-grid">
                <For each={macros().filter((m) => m.category === category)}>
                  {(macro) => (
                    <button
                      class="flow-macro-card"
                      onClick={() => flowMacrosActions.startFlow(macro.id)}
                      disabled={flowState.isRunning}
                    >
                      <span class="macro-icon">{macro.icon}</span>
                      <span class="macro-name">{macro.name}</span>
                      <span class="macro-desc">{macro.description}</span>
                      <span class="macro-steps">{macro.steps.length} steps</span>
                    </button>
                  )}
                </For>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

export function FlowProgressOverlay() {
  const currentStep = createMemo(() => flowMacrosActions.getCurrentStep());
  const progress = createMemo(() => flowMacrosActions.getProgress());

  return (
    <Show when={flowState.isRunning && flowState.showUI}>
      <div class="flow-progress-overlay">
        <div class="flow-progress-panel">
          <div class="flow-progress-header">
            <h3>
              {flowState.currentMacro?.icon} {flowState.currentMacro?.name}
            </h3>
            <button class="flow-hide-btn" onClick={() => flowMacrosActions.hideUI()}>
              Hide
            </button>
          </div>

          <div class="flow-progress-bar">
            <div class="progress-fill" style={{ width: `${progress()}%` }} />
            <span class="progress-text">{progress()}%</span>
          </div>

          <div class="flow-steps-list">
            <For each={flowState.currentMacro?.steps}>
              {(step, index) => (
                <div
                  class={`flow-step ${step.status} ${index() === flowState.currentStepIndex ? 'current' : ''}`}
                >
                  <span class="step-number">{index() + 1}</span>
                  <div class="step-info">
                    <span class="step-name">{step.name}</span>
                    <span class="step-desc">{step.description}</span>
                  </div>
                  <span class="step-status">{step.status}</span>
                </div>
              )}
            </For>
          </div>

          <Show when={currentStep()}>
            <div class="flow-current-action">
              <p>Current: {currentStep()?.name}</p>
              <div class="flow-actions">
                <button
                  class="btn-primary"
                  onClick={() => flowMacrosActions.completeCurrentStep()}
                >
                  ✓ Complete Step
                </button>
                <Show when={currentStep()?.canSkip}>
                  <button
                    class="btn-secondary"
                    onClick={() => flowMacrosActions.skipCurrentStep()}
                  >
                    Skip
                  </button>
                </Show>
                <button class="btn-danger" onClick={() => flowMacrosActions.cancelFlow()}>
                  Cancel Flow
                </button>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}

export function FlowMinimizedIndicator() {
  return (
    <Show when={flowState.isRunning && !flowState.showUI}>
      <button class="flow-minimized" onClick={() => flowMacrosActions.showUI()}>
        <span>{flowState.currentMacro?.icon}</span>
        <span>{flowMacrosActions.getProgress()}%</span>
      </button>
    </Show>
  );
}
