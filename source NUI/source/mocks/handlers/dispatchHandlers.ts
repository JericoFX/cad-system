import type { DispatchCall, DispatchUnit, SecurityCamera } from '~/stores/cadStore';
import { generateId, randomChoice, randomCoords } from '../data/generators';
import { LOCATIONS } from '../data/generators';
import { resolveRequest } from '../core/eventBus';

let mockCalls: Record<string, DispatchCall> = {};
let mockUnits: Record<string, DispatchUnit> = {};
let mockSecurityCameras: Record<string, SecurityCamera> = {};

export function initializeDispatchHandlers(): void {
  window.addEventListener('message', (event) => {
    const { action, requestId, payload } = event.data;
    
    if (!action?.startsWith('cad:req:')) return;
    
    const eventName = action.replace('cad:req:', '');
    
    switch (eventName) {
      case 'cad:getDispatchCalls': {
        const { status, priority } = payload || {};
        let calls = Object.values(mockCalls);
        
        if (status) {
          calls = calls.filter(c => c.status === status);
        }
        if (priority) {
          calls = calls.filter(c => c.priority === priority);
        }
        
        resolveRequest(requestId, { ok: true, calls });
        break;
      }
      
      case 'cad:createDispatchCall': {
        const callId = generateId('CALL');
        const call: DispatchCall = {
          callId,
          type: payload?.type || '911',
          priority: payload?.priority || 2,
          title: payload?.title || 'Emergency Call',
          description: payload?.description || '',
          location: payload?.location || randomChoice(LOCATIONS),
          coordinates: payload?.coordinates || randomCoords(),
          status: 'PENDING',
          assignedUnits: {},
          createdAt: new Date().toISOString(),
        };
        
        mockCalls[callId] = call;
        resolveRequest(requestId, { ok: true, call });
        break;
      }
      
      case 'cad:getDispatchUnits': {
        resolveRequest(requestId, Object.values(mockUnits));
        break;
      }

      case 'cad:cameras:getNextNumber': {
        const cameraNumbers = Object.values(mockSecurityCameras).map((camera) => camera.cameraNumber || 0);
        const highest = cameraNumbers.length > 0 ? Math.max(...cameraNumbers) : 0;
        resolveRequest(requestId, { ok: true, nextNumber: highest + 1 });
        break;
      }

      case 'cad:cameras:list': {
        const cameras = Object.values(mockSecurityCameras).sort((a, b) => a.cameraNumber - b.cameraNumber);
        resolveRequest(requestId, { ok: true, cameras });
        break;
      }

      case 'cad:cameras:get': {
        const { cameraId } = payload || {};
        const camera = cameraId ? mockSecurityCameras[cameraId] : undefined;
        if (!camera) {
          resolveRequest(requestId, { ok: false, error: 'camera_not_found' });
          return;
        }

        resolveRequest(requestId, { ok: true, camera });
        break;
      }

      case 'cad:cameras:watch': {
        const { cameraId } = payload || {};
        const camera = cameraId ? mockSecurityCameras[cameraId] : undefined;
        if (!camera) {
          resolveRequest(requestId, { ok: false, error: 'camera_not_found' });
          return;
        }

        if (camera.status !== 'ACTIVE') {
          resolveRequest(requestId, { ok: false, error: 'camera_disabled' });
          return;
        }

        resolveRequest(requestId, { ok: true, camera });
        break;
      }

      case 'cad:cameras:stopWatch': {
        resolveRequest(requestId, { ok: true });
        break;
      }

      case 'cad:cameras:setStatus': {
        const { cameraId, status } = payload || {};
        const camera = cameraId ? mockSecurityCameras[cameraId] : undefined;
        if (!camera) {
          resolveRequest(requestId, { ok: false, error: 'camera_not_found' });
          return;
        }

        if (status !== 'ACTIVE' && status !== 'DISABLED') {
          resolveRequest(requestId, { ok: false, error: 'invalid_status' });
          return;
        }

        camera.status = status;
        camera.updatedAt = new Date().toISOString();
        resolveRequest(requestId, { ok: true, camera });
        break;
      }

      case 'cad:cameras:remove': {
        const { cameraId } = payload || {};
        const camera = cameraId ? mockSecurityCameras[cameraId] : undefined;
        if (!camera) {
          resolveRequest(requestId, { ok: false, error: 'camera_not_found' });
          return;
        }

        delete mockSecurityCameras[cameraId];
        resolveRequest(requestId, { ok: true, cameraId });
        break;
      }
      
      case 'cad:getUnitStatus': {
        const { unitId } = payload || {};
        const unit = mockUnits[unitId];
        resolveRequest(requestId, unit || { ok: false, error: 'unit_not_found' });
        break;
      }
      
      case 'cad:updateUnitStatus': {
        const { unitId, status, location } = payload || {};
        const unit = mockUnits[unitId];
        
        if (!unit) {
          resolveRequest(requestId, { ok: false, error: 'unit_not_found' });
          return;
        }
        
        if (status) unit.status = status;
        if (location) unit.location = location;
        
        resolveRequest(requestId, { ok: true, unit });
        break;
      }
      
      case 'cad:assignUnitToCall': {
        const { callId, unitId } = payload || {};
        const call = mockCalls[callId];
        const unit = mockUnits[unitId];
        
        if (!call || !unit) {
          resolveRequest(requestId, { ok: false, error: 'not_found' });
          return;
        }
        
        call.assignedUnits[unitId] = { assignedAt: new Date().toISOString() };
        call.status = 'ACTIVE';
        unit.status = 'BUSY';
        unit.currentCall = callId;
        
        resolveRequest(requestId, { ok: true, call, unit });
        break;
      }
      
      case 'cad:unassignUnitFromCall': {
        const { callId, unitId } = payload || {};
        const call = mockCalls[callId];
        const unit = mockUnits[unitId];
        
        if (!call || !unit) {
          resolveRequest(requestId, { ok: false, error: 'not_found' });
          return;
        }
        
        delete call.assignedUnits[unitId];
        unit.status = 'AVAILABLE';
        unit.currentCall = undefined;
        
        if (Object.keys(call.assignedUnits).length === 0) {
          call.status = 'PENDING';
        }
        
        resolveRequest(requestId, { ok: true, call, unit });
        break;
      }
      
      case 'cad:closeDispatchCall': {
        const { callId } = payload || {};
        const call = mockCalls[callId];
        
        if (!call) {
          resolveRequest(requestId, { ok: false, error: 'not_found' });
          return;
        }
        
        call.status = 'CLOSED';
        
        Object.keys(call.assignedUnits).forEach(unitId => {
          const unit = mockUnits[unitId];
          if (unit) {
            unit.status = 'AVAILABLE';
            unit.currentCall = undefined;
          }
        });
        
        resolveRequest(requestId, { ok: true, call });
        break;
      }
      
      case 'cad:getNearestUnit': {
        const units = Object.values(mockUnits).filter(u => u.status === 'AVAILABLE');
        
        if (units.length === 0) {
          resolveRequest(requestId, { ok: false, error: 'no_units_available' });
          return;
        }
        
        resolveRequest(requestId, { ok: true, unit: units[0] });
        break;
      }
      
      case 'cad:updateOfficerStatus': {
        resolveRequest(requestId, { ok: true });
        break;
      }
    }
  });
}

export function setMockCalls(calls: Record<string, DispatchCall>): void {
  mockCalls = { ...calls };
}

export function setMockUnits(units: Record<string, DispatchUnit>): void {
  mockUnits = { ...units };
}

export function setMockSecurityCameras(cameras: Record<string, SecurityCamera>): void {
  mockSecurityCameras = { ...cameras };
}

export function getMockCalls(): Record<string, DispatchCall> {
  return mockCalls;
}

export function getMockUnits(): Record<string, DispatchUnit> {
  return mockUnits;
}

export function getMockSecurityCameras(): Record<string, SecurityCamera> {
  return mockSecurityCameras;
}

export function clearMockDispatch(): void {
  mockCalls = {};
  mockUnits = {};
  mockSecurityCameras = {};
}

export function addMockCall(call: DispatchCall): void {
  mockCalls[call.callId] = call;
}

export function addMockUnit(unit: DispatchUnit): void {
  mockUnits[unit.unitId] = unit;
}

export function addMockSecurityCamera(camera: SecurityCamera): void {
  mockSecurityCameras[camera.cameraId] = camera;
}
