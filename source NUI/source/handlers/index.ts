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

export function initAllNuiHandlers(): void {
  initNuiRouter();

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
}

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
