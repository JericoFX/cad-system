import type { StagingEvidence } from '~/stores/cadStore';
import type { ForensicTrace, AnalysisResult } from '../types';
import { generateId, randomInt } from '../data/generators';
import { resolveRequest } from '../core/eventBus';

let mockWorldTraces: Record<string, ForensicTrace> = {};
let mockStagingEvidence: StagingEvidence[] = [];
let mockAnalysisResults: Record<string, AnalysisResult> = {};

export function initializeForensicHandlers(): void {
  window.addEventListener('message', (event) => {
    const { action, requestId, payload } = event.data;
    
    if (!action?.startsWith('cad:req:')) return;
    
    const eventName = action.replace('cad:req:', '');
    
    switch (eventName) {
      case 'cad:forensic:checkInLab': {
        resolveRequest(requestId, {
          enabled: true,
          inLab: true,
        });
        break;
      }
      
      case 'cad:forensic:getPendingEvidence': {
        resolveRequest(requestId, mockStagingEvidence);
        break;
      }
      
      case 'cad:forensic:analyzeEvidence': {
        const { caseId, evidenceId } = payload || {};
        const analysisId = generateId('ANL');
        
        const result: AnalysisResult = {
          analysisId,
          caseId,
          evidenceId,
          startedBy: 'OFFICER_101',
          startedAt: new Date().toISOString(),
          status: 'IN_PROGRESS',
        };
        
        mockAnalysisResults[analysisId] = result;
        resolveRequest(requestId, result);
        break;
      }
      
      case 'cad:forensic:completeAnalysis': {
        const { analysisId, result: analysisData } = payload || {};
        const analysis = mockAnalysisResults[analysisId];
        
        if (!analysis) {
          resolveRequest(requestId, { ok: false, error: 'analysis_not_found' });
          return;
        }
        
        analysis.status = 'COMPLETED';
        analysis.result = analysisData;
        analysis.completedAt = new Date().toISOString();
        analysis.completedBy = 'OFFICER_101';
        
        resolveRequest(requestId, analysis);
        break;
      }
      
      case 'cad:forensic:getAnalysisResults': {
        const { evidenceId } = payload || {};
        let results = Object.values(mockAnalysisResults);
        
        if (evidenceId) {
          results = results.filter(r => r.evidenceId === evidenceId);
        }
        
        resolveRequest(requestId, results);
        break;
      }
      
      case 'cad:forensic:compareEvidence': {
        const { evidenceA, evidenceB } = payload || {};
        
        resolveRequest(requestId, {
          ok: true,
          evidenceA,
          evidenceB,
          confidence: randomInt(60, 98),
          summary: 'Automated comparison completed',
        });
        break;
      }
      
      case 'cad:forensic:collectEvidence': {
        resolveRequest(requestId, { ok: true });
        break;
      }
      
      case 'cad:forensic:getNearbyWorldTraces': {
        const traces = Object.values(mockWorldTraces).map(trace => ({
          traceId: trace.traceId,
          evidenceType: trace.evidenceType,
          description: trace.description,
          coords: { x: trace.coords.x, y: trace.coords.y, z: trace.coords.z },
          distance: randomInt(1, 20),
          metadata: trace.metadata,
          createdAt: trace.createdAt,
          expiresAt: trace.expiresAt,
        }));
        
        resolveRequest(requestId, { ok: true, traces });
        break;
      }
      
      case 'cad:forensic:bagWorldTrace': {
        const { traceId } = payload || {};
        const trace = mockWorldTraces[traceId];
        
        if (!trace) {
          resolveRequest(requestId, { ok: false, error: 'trace_not_found' });
          return;
        }
        
        const staged: StagingEvidence = {
          stagingId: generateId('STAGE'),
          evidenceType: trace.evidenceType,
          data: {
            description: trace.description,
            sourceTraceId: trace.traceId,
            collectedAt: new Date().toISOString(),
            metadata: trace.metadata,
          },
          createdAt: new Date().toISOString(),
        };
        
        mockStagingEvidence.push(staged);
        delete mockWorldTraces[traceId];
        
        resolveRequest(requestId, {
          ok: true,
          staging: staged,
          traceId: trace.traceId,
        });
        break;
      }
      
      case 'cad:forensic:debugCreateTrace': {
        const trace: ForensicTrace = {
          traceId: generateId('TRACE'),
          evidenceType: 'DNA',
          description: 'Debug forensic trace',
          coords: { x: 0, y: 0, z: 0 },
          metadata: {},
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          sourceResource: 'debug',
        };
        
        mockWorldTraces[trace.traceId] = trace;
        resolveRequest(requestId, { ok: true, trace });
        break;
      }
    }
  });
}

export function setMockWorldTraces(traces: Record<string, ForensicTrace>): void {
  mockWorldTraces = { ...traces };
}

export function setMockStagingEvidence(evidence: StagingEvidence[]): void {
  mockStagingEvidence = [...evidence];
}

export function setMockAnalysisResults(results: Record<string, AnalysisResult>): void {
  mockAnalysisResults = { ...results };
}

export function getMockWorldTraces(): Record<string, ForensicTrace> {
  return mockWorldTraces;
}

export function getMockStagingEvidence(): StagingEvidence[] {
  return mockStagingEvidence;
}

export function getMockAnalysisResults(): Record<string, AnalysisResult> {
  return mockAnalysisResults;
}

export function clearMockForensics(): void {
  mockWorldTraces = {};
  mockStagingEvidence = [];
  mockAnalysisResults = {};
}

export function addMockWorldTrace(trace: ForensicTrace): void {
  mockWorldTraces[trace.traceId] = trace;
}

export function addMockStagingEvidence(evidence: StagingEvidence): void {
  mockStagingEvidence.push(evidence);
}
