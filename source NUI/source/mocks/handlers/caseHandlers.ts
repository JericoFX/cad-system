import type { Case, Evidence } from '~/stores/cadStore';
import { generateId } from '../data/generators';
import { resolveRequest } from '../core/eventBus';

let mockCases: Record<string, Case> = {};

export function initializeCaseHandlers(): void {
  window.addEventListener('message', (event) => {
    const { action, requestId, payload } = event.data;
    
    if (!action?.startsWith('cad:req:')) return;
    
    const eventName = action.replace('cad:req:', '');
    
    switch (eventName) {
      case 'cad:getCase': {
        const caseId = typeof payload === 'string' ? payload : payload?.caseId;
        const caseData = mockCases[caseId];
        
        resolveRequest(requestId, caseData || { ok: false, error: 'not_found' });
        break;
      }
      
      case 'cad:searchCases': {
        const { status, caseType, priority } = payload || {};
        let results = Object.values(mockCases);
        
        if (status) {
          results = results.filter(c => c.status === status);
        }
        if (caseType) {
          results = results.filter(c => c.caseType === caseType);
        }
        if (priority) {
          results = results.filter(c => c.priority === priority);
        }
        
        resolveRequest(requestId, { ok: true, cases: results });
        break;
      }
      
      case 'cad:createCase': {
        const caseId = generateId('CASE');
        const newCase: Case = {
          caseId,
          caseType: payload?.caseType || 'GENERAL',
          title: payload?.title || 'Untitled Case',
          description: payload?.description || '',
          status: 'OPEN',
          priority: payload?.priority || 2,
          createdBy: 'OFFICER_101',
          assignedTo: payload?.assignedTo || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          notes: [],
          evidence: [],
          tasks: [],
        };
        
        mockCases[caseId] = newCase;
        resolveRequest(requestId, newCase);
        break;
      }
      
      case 'cad:updateCase': {
        const { caseId, ...updates } = payload || {};
        const caseObj = mockCases[caseId];
        
        if (!caseObj) {
          resolveRequest(requestId, { ok: false, error: 'not_found' });
          return;
        }
        
        Object.assign(caseObj, updates, { updatedAt: new Date().toISOString() });
        resolveRequest(requestId, caseObj);
        break;
      }
      
      case 'cad:closeCase': {
        const { caseId } = payload || {};
        const caseObj = mockCases[caseId];
        
        if (!caseObj) {
          resolveRequest(requestId, { ok: false, error: 'not_found' });
          return;
        }
        
        caseObj.status = 'CLOSED';
        caseObj.updatedAt = new Date().toISOString();
        resolveRequest(requestId, { ok: true, caseId });
        break;
      }
      
      case 'cad:attachEvidence': {
        const { caseId, evidenceData } = payload || {};
        const caseObj = mockCases[caseId];
        
        if (!caseObj) {
          resolveRequest(requestId, { ok: false, error: 'not_found' });
          return;
        }
        
        const evidence: Evidence = {
          evidenceId: generateId('EVID'),
          caseId,
          evidenceType: evidenceData?.evidenceType || 'PHYSICAL',
          data: evidenceData?.data || {},
          attachedBy: 'OFFICER_101',
          attachedAt: new Date().toISOString(),
          custodyChain: [],
        };
        
        caseObj.evidence.push(evidence);
        caseObj.updatedAt = new Date().toISOString();
        resolveRequest(requestId, evidence);
        break;
      }
      
      case 'cad:getCases': {
        resolveRequest(requestId, Object.values(mockCases));
        break;
      }
      
      case 'cad:getCaseEvidence': {
        const { caseId } = payload || {};
        const caseObj = mockCases[caseId];
        resolveRequest(requestId, caseObj?.evidence || []);
        break;
      }
      
      case 'cad:getCaseNotes': {
        const { caseId } = payload || {};
        const caseObj = mockCases[caseId];
        resolveRequest(requestId, caseObj?.notes || []);
        break;
      }
    }
  });
}

export function setMockCases(cases: Record<string, Case>): void {
  mockCases = { ...cases };
}

export function getMockCases(): Record<string, Case> {
  return mockCases;
}

export function clearMockCases(): void {
  mockCases = {};
}

export function addMockCase(caseData: Case): void {
  mockCases[caseData.caseId] = caseData;
}
