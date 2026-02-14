import { initializeCaseHandlers } from './caseHandlers';
import { initializeDispatchHandlers } from './dispatchHandlers';
import { initializeEmsHandlers } from './emsHandlers';
import { initializeForensicHandlers } from './forensicHandlers';
import { initializePersonVehicleHandlers } from './personVehicleHandlers';
import { initializeFinesHandlers } from './finesHandlers';

export function initializeAllHandlers(): void {
  initializeCaseHandlers();
  initializeDispatchHandlers();
  initializeEmsHandlers();
  initializeForensicHandlers();
  initializePersonVehicleHandlers();
  initializeFinesHandlers();
}

export * from './caseHandlers';
export * from './dispatchHandlers';
export * from './emsHandlers';
export * from './forensicHandlers';
export * from './personVehicleHandlers';
export * from './finesHandlers';
