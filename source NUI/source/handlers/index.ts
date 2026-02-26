/**
 * NUI Handlers Index
 * Central registration for all automatic NUI handlers
 */

import { initNuiRouter } from '~/utils/nuiRouter';
import { initDispatchHandlers } from './dispatchHandlers';
import { initCaseHandlers } from './caseHandlers';
import { initEvidenceHandlers } from './evidenceHandlers';
import { initEmsHandlers } from './emsHandlers';
import { initForensicsHandlers } from './forensicsHandlers';
import { initPhotoHandlers } from './photoHandlers';
import { initFineHandlers } from './fineHandlers';
import { initPoliceHandlers } from './policeHandlers';
import { initCadHandlers } from './cadHandlers';
import { initVehicleHandlers } from './vehicleHandlers';
import { initSecurityCameraHandlers } from './securityCameraHandlers';

/**
 * Initialize all NUI handlers
 * Called once at system startup
 */
export function initAllNuiHandlers(): void {
  // Ensure router is initialized
  initNuiRouter();
  
  // Initialize all domain handlers
  initCadHandlers();
  initVehicleHandlers();
  initSecurityCameraHandlers();
  initDispatchHandlers();
  initCaseHandlers();
  initEvidenceHandlers();
  initEmsHandlers();
  initForensicsHandlers();
  initPhotoHandlers();
  initFineHandlers();
  initPoliceHandlers();
  
  console.log('[NUI Handlers] All handlers registered');
}

// Re-export all handlers for manual use
export * from './cadHandlers';
export * from './vehicleHandlers';
export * from './securityCameraHandlers';
export * from './dispatchHandlers';
export * from './caseHandlers';
export * from './evidenceHandlers';
export * from './emsHandlers';
export * from './forensicsHandlers';
export * from './photoHandlers';
export * from './fineHandlers';
export * from './policeHandlers';
