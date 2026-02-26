import { createSignal, Show, For, onMount, onCleanup } from 'solid-js';
import { isEnvBrowser } from '~/utils/misc';
import { ALL_SCENARIOS, getScenarioById } from '../scenarios';
import type { Scenario } from '../types';
import { loadScenario } from '../core/scenarioLoader';
import { isMockEnabled, setMockEnabled } from '../core/requestInterceptor';

export function MockController() {
  const [isVisible, setIsVisible] = createSignal(false);
  const [isMinimized, setIsMinimized] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);
  const [currentScenario, setCurrentScenario] = createSignal<string | null>(null);
  const [loadingProgress, setLoadingProgress] = createSignal(0);
  const [position, setPosition] = createSignal({ x: 20, y: 80 });
  const [isDragging, setIsDragging] = createSignal(false);
  let dragOffset = { x: 0, y: 0 };
  let containerRef: HTMLDivElement | undefined;

  onMount(() => {
    if (isEnvBrowser()) {
      setIsVisible(true);
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging()) return;
      
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    onCleanup(() => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    });
  });

  const startDrag = (e: MouseEvent) => {
    if (!containerRef) return;
    const rect = containerRef.getBoundingClientRect();
    dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    setIsDragging(true);
  };

  const handleScenarioClick = async (scenario: Scenario) => {
    setIsLoading(true);
    setLoadingProgress(0);
    
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 100);

    await loadScenario(scenario);

    clearInterval(progressInterval);
    setLoadingProgress(100);
    
    setTimeout(() => {
      setIsLoading(false);
      setLoadingProgress(0);
      setCurrentScenario(scenario.id);
    }, 500);
  };

  const toggleMock = () => {
    setMockEnabled(!isMockEnabled());
  };

  if (!isEnvBrowser()) return null;

  return (
    <Show when={isVisible()}>
      <div
        ref={containerRef}
        class={`fixed z-50 ${isDragging() ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          left: `${position().x}px`,
          top: `${position().y}px`,
          'user-select': 'none',
        }}
      >
        <Show when={isMinimized()}>
          <button
            onClick={() => setIsMinimized(false)}
            class="bg-gray-800 text-white p-2 rounded-full shadow-lg hover:bg-gray-700 transition-colors"
            title="Open Mock Controller"
          >
            <span class="text-xl">🎮</span>
          </button>
        </Show>

        <Show when={!isMinimized()}>
          <div class="bg-gray-900/95 border border-gray-700 rounded-lg shadow-2xl overflow-hidden backdrop-blur-sm min-w-[280px]">
            <div
              class="bg-gray-800 px-3 py-2 flex items-center justify-between border-b border-gray-700 cursor-grab active:cursor-grabbing"
              onMouseDown={startDrag}
            >
              <div class="flex items-center gap-2">
                <span class="text-lg">🎮</span>
                <span class="text-white font-semibold text-sm">Mock Controller</span>
                <Show when={isMockEnabled()}>
                  <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Mocks Active" />
                </Show>
              </div>
              <div class="flex items-center gap-1">
                <button
                  onClick={() => setIsMinimized(true)}
                  class="text-gray-400 hover:text-white p-1"
                  title="Minimize"
                >
                  −
                </button>
                <button
                  onClick={() => setIsVisible(false)}
                  class="text-gray-400 hover:text-red-400 p-1"
                  title="Close"
                >
                  ×
                </button>
              </div>
            </div>

            <div class="p-3 space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-gray-300 text-xs">Mock System</span>
                <button
                  onClick={toggleMock}
                  class={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    isMockEnabled()
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {isMockEnabled() ? 'ON' : 'OFF'}
                </button>
              </div>

              <Show when={isLoading()}>
                <div class="space-y-1">
                  <div class="text-gray-300 text-xs">Loading scenario...</div>
                  <div class="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${loadingProgress()}%` }}
                    />
                  </div>
                </div>
              </Show>

              <Show when={currentScenario()}>
                <div class="text-xs text-gray-400">
                  Current: <span class="text-blue-400">{getScenarioById(currentScenario()!)?.name}</span>
                </div>
              </Show>

              <div class="border-t border-gray-700 pt-2">
                <div class="text-gray-400 text-xs mb-2">Scenarios</div>
                <div class="grid grid-cols-3 gap-1 max-h-[300px] overflow-y-auto">
                  <For each={ALL_SCENARIOS}>
                    {(scenario) => (
                      <button
                        onClick={() => handleScenarioClick(scenario)}
                        disabled={isLoading()}
                        class={`p-2 rounded text-xs transition-all ${
                          currentScenario() === scenario.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        } ${isLoading() ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={scenario.description}
                      >
                        <div class="text-lg mb-1">{scenario.icon}</div>
                        <div class="truncate">{scenario.name}</div>
                      </button>
                    )}
                  </For>
                </div>
              </div>

              <div class="border-t border-gray-700 pt-2 text-xs text-gray-500 text-center">
                Click scenario to load
              </div>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
}
