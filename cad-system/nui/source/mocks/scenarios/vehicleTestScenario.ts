import { terminalActions } from '~/stores/terminalStore';

export const vehicleTestScenario = {
  name: 'Vehicle Context',
  description: 'Police vehicle with active CAD interface',
  setup: () => {
    // Set vehicle context
    terminalActions.setVehicleContext(true);
    terminalActions.setVehicleSpeed(35);
    terminalActions.setActiveModal('VEHICLE_CAD');
    
    // Simulate radar data
    window.postMessage({
      action: 'radarData',
      data: [
        { id: 1, coords: { x: 450, y: -980, z: 0 }, distance: 25, isWanted: false },
        { id: 2, coords: { x: 465, y: -995, z: 0 }, distance: 42, isWanted: true }
      ]
    }, '*');
    
    // Add to terminal history
    terminalActions.addLine('✓ Vehicle CAD activated', 'system');
    terminalActions.addLine('  Speed: 35 MPH | Radar active', 'system');
  }
};