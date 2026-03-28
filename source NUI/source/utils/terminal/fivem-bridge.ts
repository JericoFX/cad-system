import { isEnvBrowser } from '../misc';
import { fetchNui } from '../fetchNui';
import { userActions } from '~/stores/userStore';
import type { FiveMBridge, UserInfo } from './types';

export function createFiveMBridge(): FiveMBridge {
  return {
    fetch: async (eventName: string, data?: any) => {
      if (isEnvBrowser()) {
        return simulateFiveMResponse(eventName, data);
      }
      return fetchNui(eventName, data);
    },

    emit: (eventName: string, data?: any) => {
      if (!isEnvBrowser()) {
        fetchNui(eventName, data).catch(console.error);
      }
    },

    isBrowser: () => isEnvBrowser()
  };
}

function simulateFiveMResponse(eventName: string, data?: any): Promise<any> {
  return new Promise((resolve) => {
    setTimeout(() => {
      switch (eventName) {
        case 'getVehicles':
          resolve(generateMockVehicles(data));
          break;
        case 'getReports':
          resolve(generateMockReports(data));
          break;
        case 'createReport':
          resolve({ success: true, id: Math.floor(Math.random() * 1000) });
          break;
        case 'deleteReport':
          resolve({ success: true, message: 'Report deleted' });
          break;
        case 'getPlayerInfo':
          resolve(generateMockPlayer(data?.id));
          break;
        case 'cad:createCase':
          const newCase = {
            caseId: `CASE_${Date.now().toString(36).toUpperCase()}`,
            caseType: data?.caseType || 'GENERAL',
            title: data?.title || 'Untitled Case',
            description: data?.description || '',
            status: 'OPEN',
            priority: data?.priority || 2,
            createdBy: userActions.getCurrentUserId(),
            assignedTo: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            notes: [],
            evidence: [],
            tasks: [],
          };
          resolve(newCase);
          break;
        case 'cad:getCase':
          resolve({
            caseId: data,
            caseType: 'GENERAL',
            title: 'Mock Case',
            description: '',
            status: 'OPEN',
            priority: 2,
            createdBy: userActions.getCurrentUserId(),
            assignedTo: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            notes: [],
            evidence: [],
            tasks: [],
          });
          break;
        case 'cad:closeCase':
          resolve({ success: true, caseId: data });
          break;
        case 'cad:attachEvidence':
          resolve({
            evidenceId: `EVID_${Date.now()}`,
            caseId: data?.caseId,
            evidenceType: 'PHOTO',
            data: data?.data || {},
            attachedBy: 'OFFICER_101',
            attachedAt: new Date().toISOString(),
            custodyChain: []
          });
          break;
        case 'cad:removeFromStaging':
          resolve({ success: true, stagingId: data });
          break;
        default:
          console.warn(`[FiveM Bridge] Unhandled event in browser mode: ${eventName}`);
          resolve({ error: `Event not implemented in browser mode: ${eventName}` });
      }
    }, 300);
  });
}

function generateMockVehicles(filters?: any): any[] {
  const vehicles = [
    { id: 1, name: 'Police Cruiser', status: 'active', location: 'Downtown', driver: 'Officer Smith', type: 'Emergency' },
    { id: 2, name: 'Ambulance A-12', status: 'busy', location: 'Hospital', driver: 'Medic Johnson', type: 'Medical' },
    { id: 3, name: 'Fire Truck F-01', status: 'idle', location: 'Station 1', driver: 'Chief Williams', type: 'Fire' },
    { id: 4, name: 'Taxi Cab', status: 'active', location: 'Airport', driver: 'Mike Davis', type: 'Transport' },
    { id: 5, name: 'Delivery Van', status: 'maintenance', location: 'Garage', driver: 'Unassigned', type: 'Commercial' },
    { id: 6, name: 'Police Motorcycle', status: 'active', location: 'Highway', driver: 'Officer Brown', type: 'Emergency' },
  ];

  if (filters?.status && filters.status !== 'all') {
    return vehicles.filter(v => v.status === filters.status);
  }

  if (filters?.location) {
    return vehicles.filter(v => v.location.toLowerCase().includes(filters.location.toLowerCase()));
  }

  return vehicles;
}

function generateMockReports(filters?: any): any[] {
  const reports = [
    { id: 101, title: 'Armed robbery', status: 'open', priority: 'high', date: '2026-01-29', location: 'Central Bank', officer: 'Smith' },
    { id: 102, title: 'Traffic accident', status: 'resolved', priority: 'medium', date: '2026-01-28', location: 'Main St & 5th', officer: 'Johnson' },
    { id: 103, title: 'Vandalism', status: 'open', priority: 'low', date: '2026-01-28', location: 'Central Park', officer: 'Williams' },
    { id: 104, title: 'Missing person', status: 'in_progress', priority: 'critical', date: '2026-01-27', location: 'Downtown', officer: 'Brown' },
    { id: 105, title: 'Disturbance', status: 'resolved', priority: 'medium', date: '2026-01-26', location: 'North District', officer: 'Davis' },
  ];

  if (filters?.status) {
    return reports.filter(r => r.status === filters.status);
  }

  return reports;
}

function generateMockPlayer(id?: number): any {
  const players = [
    { id: 1, name: 'John Doe', money: 5000, job: 'Police', lastSeen: '2 min ago', health: 100, armor: 50 },
    { id: 2, name: 'Jane Smith', money: 12000, job: 'Medic', lastSeen: '15 min ago', health: 85, armor: 0 },
    { id: 3, name: 'Bob Johnson', money: 800, job: 'Taxi Driver', lastSeen: '1 hour ago', health: 100, armor: 0 },
  ];

  return players.find(p => p.id === id) || null;
}

export function createMockUser(): UserInfo {
  return {
    id: 'user-001',
    name: 'Admin User',
    roles: ['admin', 'user'],
    hasPermission: (permission: string) => {
      return ['admin', 'mod', 'user'].some(role =>
        role.includes(permission)
      );
    }
  };
}
