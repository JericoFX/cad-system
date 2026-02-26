import type { Fine } from '~/stores/cadStore';
import { generateId } from '../data/generators';
import { resolveRequest } from '../core/eventBus';

let mockFines: Record<string, Fine> = {};

const FINE_CATALOG = [
  { code: 'SPEED_10', description: 'Speeding 10-20 mph over', amount: 150, jailTime: 0 },
  { code: 'SPEED_20', description: 'Speeding 20+ mph over', amount: 300, jailTime: 0 },
  { code: 'SPEED_50', description: 'Speeding 50+ mph over', amount: 1000, jailTime: 0 },
  { code: 'RECKLESS', description: 'Reckless driving', amount: 500, jailTime: 0 },
  { code: 'DUI', description: 'Driving under influence', amount: 2500, jailTime: 30 },
  { code: 'ASSAULT_SIMPLE', description: 'Simple assault', amount: 1500, jailTime: 10 },
  { code: 'ASSAULT_AGGRAVATED', description: 'Aggravated assault', amount: 5000, jailTime: 60 },
  { code: 'WEAPON_ILLEGAL', description: 'Illegal weapon possession', amount: 3000, jailTime: 30 },
  { code: 'DRUGS_POSSESSION', description: 'Drug possession', amount: 2000, jailTime: 15 },
  { code: 'DRUGS_DISTRIBUTION', description: 'Drug distribution', amount: 10000, jailTime: 120 },
  { code: 'THEFT_PETTY', description: 'Petty theft', amount: 500, jailTime: 0 },
  { code: 'THEFT_GRAND', description: 'Grand theft', amount: 5000, jailTime: 30 },
  { code: 'ROBBERY', description: 'Robbery', amount: 7500, jailTime: 60 },
  { code: 'BURGLARY', description: 'Burglary', amount: 10000, jailTime: 90 },
  { code: 'HOMICIDE_MANS', description: 'Manslaughter', amount: 25000, jailTime: 180 },
  { code: 'HOMICIDE_MURDER', description: 'Murder', amount: 50000, jailTime: 999 },
  { code: 'FRAUD', description: 'Fraud', amount: 8000, jailTime: 30 },
  { code: 'VANDALISM', description: 'Vandalism', amount: 1000, jailTime: 0 },
  { code: 'TRESPASSING', description: 'Trespassing', amount: 500, jailTime: 0 },
  { code: 'RESIST_ARREST', description: 'Resisting arrest', amount: 2000, jailTime: 15 },
];

export function initializeFinesHandlers(): void {
  window.addEventListener('message', (event) => {
    const { action, requestId, payload } = event.data;
    
    if (!action?.startsWith('cad:req:')) return;
    
    const eventName = action.replace('cad:req:', '');
    
    switch (eventName) {
      case 'cad:getFineCatalog': {
        resolveRequest(requestId, FINE_CATALOG);
        break;
      }
      
      case 'cad:getFines': {
        const { targetId, mine } = payload || {};
        let fines = Object.values(mockFines);
        
        if (targetId) {
          fines = fines.filter(f => f.targetId === targetId);
        }
        if (mine) {
          fines = fines.filter(f => f.targetId === 'CURRENT_USER');
        }
        
        resolveRequest(requestId, fines);
        break;
      }
      
      case 'cad:createFine': {
        const { targetType, targetId, targetName, fineCode, description, amount, jailTime, isBail } = payload || {};
        
        const fine: Fine = {
          fineId: generateId('FINE'),
          targetType: targetType || 'PERSON',
          targetId: targetId || '',
          targetName: targetName || 'Unknown',
          fineCode: fineCode || 'UNK',
          description: description || '',
          amount: amount || 0,
          jailTime: jailTime || 0,
          issuedBy: 'OFFICER_101',
          issuedByName: 'Officer John Martinez',
          issuedAt: new Date().toISOString(),
          paid: false,
          paidAt: undefined,
          paidMethod: undefined,
          status: 'PENDING',
          isBail: isBail || false,
        };
        
        mockFines[fine.fineId] = fine;
        resolveRequest(requestId, fine);
        break;
      }
      
      case 'cad:payFine': {
        const { fineId, method } = payload || {};
        const fine = mockFines[fineId];
        
        if (!fine) {
          resolveRequest(requestId, { ok: false, error: 'fine_not_found' });
          return;
        }
        
        if (fine.paid) {
          resolveRequest(requestId, { ok: false, error: 'already_paid' });
          return;
        }
        
        fine.paid = true;
        fine.paidAt = new Date().toISOString();
        fine.paidMethod = method || 'CASH';
        fine.status = 'PAID';
        
        resolveRequest(requestId, fine);
        break;
      }
      
      case 'cad:payFineByTicket': {
        const { fineId } = payload || {};
        const fine = mockFines[fineId];
        
        if (!fine) {
          resolveRequest(requestId, { ok: false, error: 'fine_not_found' });
          return;
        }
        
        fine.paid = true;
        fine.paidAt = new Date().toISOString();
        fine.paidMethod = 'BANK';
        fine.status = 'PAID';
        
        resolveRequest(requestId, fine);
        break;
      }
    }
  });
}

export function setMockFines(fines: Record<string, Fine>): void {
  mockFines = { ...fines };
}

export function getMockFines(): Record<string, Fine> {
  return mockFines;
}

export function clearMockFines(): void {
  mockFines = {};
}

export function addMockFine(fine: Fine): void {
  mockFines[fine.fineId] = fine;
}
