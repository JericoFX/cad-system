import { createEffect } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { CADTerminal } from './components/CADTerminal';
import { ModalManager } from './components/ModalManager';

export function App() {
  // Auto-simulate vehicle context for browser testing
  createEffect(() => {
    setTimeout(() => {
      terminalActions.setVehicleContext(true);
      terminalActions.setVehicleSpeed(35);
      terminalActions.setActiveModal('VEHICLE_CAD');
      
      // Simulate speed increase to trigger compact mode
      let currentSpeed = 35;
      const speedInterval = setInterval(() => {
        currentSpeed += 5;
        terminalActions.setVehicleSpeed(currentSpeed);
        
        if (currentSpeed >= 50) {
          clearInterval(speedInterval);
        }
      }, 2000);
    }, 1000);
  });

  return (
    <div class="terminal-container">
      <div class="terminal-background" />
      <div class="terminal-frame">
        <CADTerminal />
        <ModalManager />
      </div>
    </div>
  );
}