
import { createStore } from 'solid-js/store';

export type VehicleType = 'PATROL' | 'SWAT' | 'EMS' | 'DETECTIVE' | 'AIR' | 'MOTOR';
export type VehicleStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'RETIRED';

export interface FleetVehicle {
  unitId: string;
  vehicleType: VehicleType;
  model: string;
  plate: string;
  status: VehicleStatus;
  
  location: {
    x: number;
    y: number;
    z: number;
    heading: number;
    speed: number;
    lastUpdate: string;
  };
  
  assignedTo?: {
    officerId: string;
    name: string;
    badge: string;
    assignedAt: string;
  };
  
  fuel: number;
  damage: number;
  lastMaintenance: string;
  nextMaintenance: string;
  totalKm: number;
  
  department: 'POLICE' | 'EMS';
  station: string;
}

export interface FleetUpdate {
  unitId: string;
  location: {
    x: number;
    y: number;
    z: number;
  };
  heading: number;
  speed: number;
  timestamp: string;
}

export interface FleetState {
  vehicles: Record<string, FleetVehicle>;
  selectedVehicle: string | null;
  filterDepartment: 'ALL' | 'POLICE' | 'EMS';
  filterStatus: VehicleStatus | 'ALL';
  lastGPSUpdate: string;
  isTracking: boolean;
}

const initialState: FleetState = {
  vehicles: {},
  selectedVehicle: null,
  filterDepartment: 'ALL',
  filterStatus: 'ALL',
  lastGPSUpdate: '',
  isTracking: false
};

export const [fleetState, setFleetState] = createStore<FleetState>(initialState);

export const fleetActions = {
  initializeFleet() {
    const vehicles: Record<string, FleetVehicle> = {
      'PD-01': {
        unitId: 'PD-01',
        vehicleType: 'PATROL',
        model: 'Crown Victoria',
        plate: 'PD0001',
        status: 'AVAILABLE',
        location: { x: 0, y: 0, z: 0, heading: 0, speed: 0, lastUpdate: new Date().toISOString() },
        fuel: 100,
        damage: 0,
        lastMaintenance: new Date().toISOString(),
        nextMaintenance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        totalKm: 15000,
        department: 'POLICE',
        station: 'Central'
      },
      'PD-02': {
        unitId: 'PD-02',
        vehicleType: 'PATROL',
        model: 'Dodge Charger',
        plate: 'PD0002',
        status: 'IN_USE',
        location: { x: 100, y: 200, z: 0, heading: 45, speed: 45, lastUpdate: new Date().toISOString() },
        assignedTo: {
          officerId: 'OFF_001',
          name: 'Carlos Martinez',
          badge: 'B-452',
          assignedAt: new Date().toISOString()
        },
        fuel: 65,
        damage: 5,
        lastMaintenance: new Date().toISOString(),
        nextMaintenance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        totalKm: 23000,
        department: 'POLICE',
        station: 'Central'
      },
      'EMS-01': {
        unitId: 'EMS-01',
        vehicleType: 'EMS',
        model: 'Ambulancia Ford',
        plate: 'EMS001',
        status: 'IN_USE',
        location: { x: -150, y: 300, z: 0, heading: 180, speed: 60, lastUpdate: new Date().toISOString() },
        assignedTo: {
          officerId: 'EMS_001',
          name: 'Maria Gonzalez',
          badge: 'E-123',
          assignedAt: new Date().toISOString()
        },
        fuel: 80,
        damage: 0,
        lastMaintenance: new Date().toISOString(),
        nextMaintenance: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        totalKm: 45000,
        department: 'EMS',
        station: 'Hospital General'
      },
      'SW-01': {
        unitId: 'SW-01',
        vehicleType: 'SWAT',
        model: 'BearCat',
        plate: 'SW0001',
        status: 'AVAILABLE',
        location: { x: 500, y: -200, z: 0, heading: 90, speed: 0, lastUpdate: new Date().toISOString() },
        fuel: 95,
        damage: 0,
        lastMaintenance: new Date().toISOString(),
        nextMaintenance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        totalKm: 8000,
        department: 'POLICE',
        station: 'Base SWAT'
      },
      'AIR-01': {
        unitId: 'AIR-01',
        vehicleType: 'AIR',
        model: 'Helicóptero PD',
        plate: 'AIR001',
        status: 'MAINTENANCE',
        location: { x: 0, y: 0, z: 50, heading: 0, speed: 0, lastUpdate: new Date().toISOString() },
        fuel: 40,
        damage: 15,
        lastMaintenance: new Date().toISOString(),
        nextMaintenance: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        totalKm: 12000,
        department: 'POLICE',
        station: 'Helipuerto Central'
      }
    };
    
    setFleetState('vehicles', vehicles);
  },
  
  updateGPS(updates: FleetUpdate[]) {
    const now = new Date().toISOString();
    
    updates.forEach(update => {
      const vehicle = fleetState.vehicles[update.unitId];
      if (vehicle) {
        setFleetState('vehicles', update.unitId, 'location', {
          x: update.location.x,
          y: update.location.y,
          z: update.location.z,
          heading: update.heading,
          speed: update.speed,
          lastUpdate: update.timestamp
        });
      }
    });
    
    setFleetState('lastGPSUpdate', now);
  },
  
  assignVehicle(unitId: string, officerId: string, officerName: string, badge: string): boolean {
    const vehicle = fleetState.vehicles[unitId];
    if (!vehicle || vehicle.status !== 'AVAILABLE') return false;
    
    setFleetState('vehicles', unitId, {
      ...vehicle,
      status: 'IN_USE',
      assignedTo: {
        officerId,
        name: officerName,
        badge,
        assignedAt: new Date().toISOString()
      }
    });
    
    return true;
  },
  
  returnVehicle(unitId: string): boolean {
    const vehicle = fleetState.vehicles[unitId];
    if (!vehicle || vehicle.status !== 'IN_USE') return false;
    
    setFleetState('vehicles', unitId, {
      ...vehicle,
      status: 'AVAILABLE',
      assignedTo: undefined
    });
    
    return true;
  },
  
  reportDamage(unitId: string, damage: number): boolean {
    const vehicle = fleetState.vehicles[unitId];
    if (!vehicle) return false;
    
    const newDamage = Math.min(100, vehicle.damage + damage);
    
    setFleetState('vehicles', unitId, {
      ...vehicle,
      damage: newDamage,
      status: newDamage >= 50 ? 'MAINTENANCE' : vehicle.status
    });
    
    return true;
  },
  
  updateFuel(unitId: string, fuel: number): boolean {
    const vehicle = fleetState.vehicles[unitId];
    if (!vehicle) return false;
    
    setFleetState('vehicles', unitId, 'fuel', Math.max(0, Math.min(100, fuel)));
    return true;
  },
  
  completeMaintenance(unitId: string): boolean {
    const vehicle = fleetState.vehicles[unitId];
    if (!vehicle) return false;
    
    setFleetState('vehicles', unitId, {
      ...vehicle,
      status: 'AVAILABLE',
      damage: 0,
      lastMaintenance: new Date().toISOString(),
      nextMaintenance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });
    
    return true;
  },
  
  searchVehicles(query: string): FleetVehicle[] {
    return Object.values(fleetState.vehicles).filter(
      v => 
        v.unitId.toLowerCase().includes(query.toLowerCase()) ||
        v.model.toLowerCase().includes(query.toLowerCase()) ||
        v.plate.toLowerCase().includes(query.toLowerCase()) ||
        (v.assignedTo?.name.toLowerCase().includes(query.toLowerCase())) ||
        (v.assignedTo?.badge.toLowerCase().includes(query.toLowerCase()))
    );
  },
  
  getFilteredVehicles(): FleetVehicle[] {
    return Object.values(fleetState.vehicles).filter(v => {
      if (fleetState.filterDepartment !== 'ALL' && v.department !== fleetState.filterDepartment) {
        return false;
      }
      if (fleetState.filterStatus !== 'ALL' && v.status !== fleetState.filterStatus) {
        return false;
      }
      return true;
    });
  },
  
  getByStation(station: string): FleetVehicle[] {
    return Object.values(fleetState.vehicles).filter(
      v => v.station.toLowerCase() === station.toLowerCase()
    );
  },
  
  getAvailable(): FleetVehicle[] {
    return Object.values(fleetState.vehicles).filter(
      v => v.status === 'AVAILABLE'
    );
  },
  
  getInUse(): FleetVehicle[] {
    return Object.values(fleetState.vehicles).filter(
      v => v.status === 'IN_USE'
    );
  },
  
  getInMaintenance(): FleetVehicle[] {
    return Object.values(fleetState.vehicles).filter(
      v => v.status === 'MAINTENANCE'
    );
  },
  
  getStats(): {
    total: number;
    available: number;
    inUse: number;
    maintenance: number;
    police: number;
    ems: number;
  } {
    const vehicles = Object.values(fleetState.vehicles);
    return {
      total: vehicles.length,
      available: vehicles.filter(v => v.status === 'AVAILABLE').length,
      inUse: vehicles.filter(v => v.status === 'IN_USE').length,
      maintenance: vehicles.filter(v => v.status === 'MAINTENANCE').length,
      police: vehicles.filter(v => v.department === 'POLICE').length,
      ems: vehicles.filter(v => v.department === 'EMS').length
    };
  },
  
  selectVehicle(unitId: string | null) {
    setFleetState('selectedVehicle', unitId);
  },
  
  setFilterDepartment(dept: 'ALL' | 'POLICE' | 'EMS') {
    setFleetState('filterDepartment', dept);
  },
  
  setFilterStatus(status: VehicleStatus | 'ALL') {
    setFleetState('filterStatus', status);
  },
  
  startTracking() {
    setFleetState('isTracking', true);
  },
  
  stopTracking() {
    setFleetState('isTracking', false);
  }
};

fleetActions.initializeFleet();
