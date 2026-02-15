import type { BloodSampleRequest, EMSAlert, EMSUnit } from '../types';
import { generateId } from '../data/generators';
import { resolveRequest } from '../core/eventBus';

let mockEmsUnits: Record<string, EMSUnit> = {};
let mockEmsAlerts: EMSAlert[] = [];
let mockBloodRequests: Record<string, BloodSampleRequest> = {};

export function initializeEmsHandlers(): void {
  window.addEventListener('message', (event) => {
    const { action, requestId, payload } = event.data;
    
    if (!action?.startsWith('cad:req:')) return;
    
    const eventName = action.replace('cad:req:', '');
    
    switch (eventName) {
      case 'cad:ems:getUnits': {
        resolveRequest(requestId, Object.values(mockEmsUnits));
        break;
      }
      
      case 'cad:ems:getAlerts': {
        resolveRequest(requestId, mockEmsAlerts);
        break;
      }
      
      case 'cad:ems:createAlert': {
        const alert: EMSAlert = {
          alertId: generateId('EMSALERT'),
          title: payload?.title || 'Medical Alert',
          description: payload?.description || '',
          severity: payload?.severity || 'MEDIUM',
          status: 'ACTIVE',
          createdBy: 'EMS_001',
          createdAt: new Date().toISOString(),
        };
        
        mockEmsAlerts.unshift(alert);
        resolveRequest(requestId, alert);
        break;
      }
      
      case 'cad:ems:updateUnit': {
        const { unitId, status, currentCall, location } = payload || {};
        const unit = mockEmsUnits[unitId];
        
        if (!unit) {
          resolveRequest(requestId, { ok: false, error: 'unit_not_found' });
          return;
        }
        
        if (status) unit.status = status;
        if (currentCall !== undefined) unit.currentCall = currentCall;
        if (location) unit.location = location;
        
        resolveRequest(requestId, unit);
        break;
      }
      
      case 'cad:ems:critical_patient': {
        const alert: EMSAlert = {
          alertId: generateId('EMSALERT'),
          title: `Critical Patient: ${payload?.patientName || 'Unknown'}`,
          description: `Patient ID: ${payload?.patientId || 'N/A'}`,
          severity: 'HIGH',
          status: 'ACTIVE',
          createdBy: 'EMS_001',
          createdAt: new Date().toISOString(),
        };
        
        mockEmsAlerts.unshift(alert);
        resolveRequest(requestId, alert);
        break;
      }
      
      case 'cad:ems:low_stock': {
        const alert: EMSAlert = {
          alertId: generateId('EMSALERT'),
          title: `Low Stock: ${payload?.itemId || 'Unknown'}`,
          description: `Current stock: ${payload?.currentStock || 'N/A'}`,
          severity: 'MEDIUM',
          status: 'ACTIVE',
          createdBy: 'SYSTEM',
          createdAt: new Date().toISOString(),
        };
        
        mockEmsAlerts.unshift(alert);
        resolveRequest(requestId, alert);
        break;
      }
      
      case 'cad:ems:handoff_complete': {
        const alert: EMSAlert = {
          alertId: generateId('EMSALERT'),
          title: 'Medical Handoff Completed',
          description: `Patient ${payload?.patientId || 'N/A'} linked to case ${payload?.caseId || 'N/A'}`,
          severity: 'LOW',
          status: 'ACTIVE',
          createdBy: 'SYSTEM',
          createdAt: new Date().toISOString(),
        };
        
        mockEmsAlerts.unshift(alert);
        resolveRequest(requestId, alert);
        break;
      }
      
      case 'cad:ems:getBloodRequests': {
        const { status } = payload || {};
        let requests = Object.values(mockBloodRequests);
        
        if (status) {
          requests = requests.filter(r => r.status === status);
        }
        
        resolveRequest(requestId, { ok: true, requests });
        break;
      }
      
      case 'cad:ems:createBloodRequest': {
        const requestId = generateId('BLOODREQ');
        const request: BloodSampleRequest = {
          requestId,
          caseId: payload?.caseId,
          citizenId: payload?.citizenId,
          personName: payload?.personName || 'Unknown',
          reason: payload?.reason || 'Forensic blood sample request',
          location: payload?.location,
          status: 'PENDING',
          requestedBy: 'OFFICER_101',
          requestedByName: 'Officer John Martinez',
          requestedByJob: 'police',
          requestedAt: new Date().toISOString(),
          notes: '',
        };
        
        mockBloodRequests[requestId] = request;
        resolveRequest(requestId, { ok: true, request });
        break;
      }
      
      case 'cad:ems:updateBloodRequest': {
        const { requestId, status, notes } = payload || {};
        const request = mockBloodRequests[requestId];
        
        if (!request) {
          resolveRequest(requestId, { ok: false, error: 'not_found' });
          return;
        }
        
        if (status) {
          request.status = status;
          
          if (status === 'IN_PROGRESS' && !request.analysisStartedAtMs) {
            request.analysisStartedAtMs = Date.now();
            request.analysisDurationMs = 45000;
            request.analysisEndsAtMs = request.analysisStartedAtMs + request.analysisDurationMs;
            request.analysisStartedAt = new Date().toISOString();
            request.analysisEndsAt = new Date(request.analysisEndsAtMs).toISOString();
          }
          
          if (status === 'COMPLETED') {
            request.analysisCompletedAtMs = Date.now();
            request.analysisCompletedAt = new Date().toISOString();
          }
        }
        
        if (notes !== undefined) request.notes = notes;
        
        resolveRequest(requestId, { ok: true, request });
        break;
      }
    }
  });
}

export function setMockEmsUnits(units: Record<string, EMSUnit>): void {
  mockEmsUnits = { ...units };
}

export function setMockEmsAlerts(alerts: EMSAlert[]): void {
  mockEmsAlerts = [...alerts];
}

export function setMockBloodRequests(requests: Record<string, BloodSampleRequest>): void {
  mockBloodRequests = { ...requests };
}

export function getMockEmsUnits(): Record<string, EMSUnit> {
  return mockEmsUnits;
}

export function getMockEmsAlerts(): EMSAlert[] {
  return mockEmsAlerts;
}

export function getMockBloodRequests(): Record<string, BloodSampleRequest> {
  return mockBloodRequests;
}

export function clearMockEms(): void {
  mockEmsUnits = {};
  mockEmsAlerts = [];
  mockBloodRequests = {};
}

export function addMockBloodRequest(request: BloodSampleRequest): void {
  mockBloodRequests[request.requestId] = request;
}
