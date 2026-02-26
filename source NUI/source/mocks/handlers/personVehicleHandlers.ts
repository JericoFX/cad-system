import type { Person, Vehicle, CriminalRecord, Warrant } from '~/stores/cadStore';
import { generateId } from '../data/generators';
import { ALL_PERSONS, ALL_VEHICLES } from '../data';
import { resolveRequest } from '../core/eventBus';

let mockPersons: Record<string, Person> = { ...ALL_PERSONS };
let mockVehicles: Record<string, Vehicle> = { ...ALL_VEHICLES };
let mockCriminalRecords: Record<string, CriminalRecord[]> = {};
let mockWarrants: Record<string, Warrant> = {};

export function initializePersonVehicleHandlers(): void {
  window.addEventListener('message', (event) => {
    const { action, requestId, payload } = event.data;
    
    if (!action?.startsWith('cad:req:')) return;
    
    const eventName = action.replace('cad:req:', '');
    
    switch (eventName) {
      case 'cad:searchPersons':
      case 'cad:lookup:searchPersons': {
        const { query } = payload || {};
        let results = Object.values(mockPersons);
        
        if (query) {
          const q = query.toLowerCase();
          results = results.filter(p => 
            p.firstName.toLowerCase().includes(q) ||
            p.lastName.toLowerCase().includes(q) ||
            p.citizenid.toLowerCase().includes(q) ||
            (p.phone && p.phone.includes(q))
          );
        }
        
        const rows = results.slice(0, 20);
        if (eventName === 'cad:lookup:searchPersons') {
          resolveRequest(requestId, { ok: true, persons: rows });
        } else {
          resolveRequest(requestId, rows);
        }
        break;
      }
      
      case 'cad:getPerson': {
        const { citizenId } = payload || {};
        const person = mockPersons[citizenId];
        
        resolveRequest(requestId, person || { ok: false, error: 'not_found' });
        break;
      }
      
      case 'cad:searchVehicles': {
        const { plate, model } = payload || {};
        let results = Object.values(mockVehicles);
        
        if (plate) {
          results = results.filter(v => v.plate.toLowerCase().includes(plate.toLowerCase()));
        }
        if (model) {
          results = results.filter(v => v.model.toLowerCase().includes(model.toLowerCase()));
        }
        
        resolveRequest(requestId, results.slice(0, 20));
        break;
      }
      
      case 'cad:getVehicle': {
        const { plate } = payload || {};
        const vehicle = mockVehicles[plate];
        
        resolveRequest(requestId, vehicle || { ok: false, error: 'not_found' });
        break;
      }
      
      case 'cad:getCriminalRecord': {
        const { citizenId } = payload || {};
        const records = mockCriminalRecords[citizenId] || [];
        resolveRequest(requestId, records);
        break;
      }
      
      case 'cad:addCriminalRecord': {
        const { citizenId, record } = payload || {};
        
        if (!mockCriminalRecords[citizenId]) {
          mockCriminalRecords[citizenId] = [];
        }
        
        const newRecord: CriminalRecord = {
          ...record,
          recordId: generateId('REC'),
          citizenid: citizenId,
          arrestingOfficer: 'OFFICER_101',
          arrestedAt: new Date().toISOString(),
        };
        
        mockCriminalRecords[citizenId].push(newRecord);
        resolveRequest(requestId, { ok: true, record: newRecord });
        break;
      }
      
      case 'cad:getWarrants': {
        const { citizenId } = payload || {};
        let warrants = Object.values(mockWarrants);
        
        if (citizenId) {
          warrants = warrants.filter(w => w.citizenid === citizenId);
        }
        
        resolveRequest(requestId, warrants);
        break;
      }
      
      case 'cad:createWarrant': {
        const { citizenId, personName, type, reason } = payload || {};
        
        const warrant: Warrant = {
          warrantId: generateId('WAR'),
          citizenid: citizenId,
          personName: personName || 'Unknown',
          type: type || 'ARREST',
          reason: reason || '',
          issuedBy: 'OFFICER_101',
          issuedByName: 'Officer John Martinez',
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          active: true,
          executed: false,
        };
        
        mockWarrants[warrant.warrantId] = warrant;
        resolveRequest(requestId, { ok: true, warrant });
        break;
      }
      
      case 'cad:updateWarrant': {
        const { warrantId, active, executed } = payload || {};
        const warrant = mockWarrants[warrantId];
        
        if (!warrant) {
          resolveRequest(requestId, { ok: false, error: 'not_found' });
          return;
        }
        
        if (active !== undefined) warrant.active = active;
        if (executed !== undefined) warrant.executed = executed;
        
        resolveRequest(requestId, { ok: true, warrant });
        break;
      }
      
      case 'cad:getBOLOs': {
        resolveRequest(requestId, []);
        break;
      }
      
      case 'cad:createBOLO': {
        resolveRequest(requestId, { ok: true });
        break;
      }
      
      case 'cad:searchPlate': {
        const { plate } = payload || {};
        const vehicle = mockVehicles[plate?.toUpperCase()];
        
        if (vehicle) {
          resolveRequest(requestId, {
            ok: true,
            vehicle: {
              plate: vehicle.plate,
              model: vehicle.model,
              make: vehicle.make,
              year: vehicle.year,
              color: vehicle.color,
              ownerId: vehicle.ownerId,
              ownerName: vehicle.ownerName,
              registrationStatus: vehicle.registrationStatus,
              insuranceStatus: vehicle.insuranceStatus,
              flags: vehicle.flags,
              stolen: vehicle.stolen,
            },
            owner: vehicle.ownerId ? mockPersons[vehicle.ownerId] : null,
          });
        } else {
          resolveRequest(requestId, { ok: false, error: 'not_found' });
        }
        break;
      }
    }
  });
}

export function setMockPersons(persons: Record<string, Person>): void {
  mockPersons = { ...persons };
}

export function setMockVehicles(vehicles: Record<string, Vehicle>): void {
  mockVehicles = { ...vehicles };
}

export function setMockCriminalRecords(records: Record<string, CriminalRecord[]>): void {
  mockCriminalRecords = { ...records };
}

export function setMockWarrants(warrants: Record<string, Warrant>): void {
  mockWarrants = { ...warrants };
}

export function getMockPersons(): Record<string, Person> {
  return mockPersons;
}

export function getMockVehicles(): Record<string, Vehicle> {
  return mockVehicles;
}

export function getMockWarrants(): Record<string, Warrant> {
  return mockWarrants;
}

export function clearMockPersonsVehicles(): void {
  mockPersons = {};
  mockVehicles = {};
  mockCriminalRecords = {};
  mockWarrants = {};
}

export function addMockPerson(person: Person): void {
  mockPersons[person.citizenid] = person;
}

export function addMockVehicle(vehicle: Vehicle): void {
  mockVehicles[vehicle.plate] = vehicle;
}

export function addMockWarrant(warrant: Warrant): void {
  mockWarrants[warrant.warrantId] = warrant;
}
