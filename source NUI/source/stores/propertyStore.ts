
import { createStore } from 'solid-js/store';

export type PropertyType = 'HOUSE' | 'APARTMENT' | 'BUSINESS' | 'WAREHOUSE' | 'GARAGE';

export interface Property {
  propertyId: string;
  address: string;
  type: PropertyType;
  
  currentOwner: {
    citizenId: string;
    name: string;
  };
  
  businessType?: string;
  businessName?: string;
  
  coordinates: {
    x: number;
    y: number;
    z: number;
  };
  
  registeredAt: string;
  lastUpdated: string;
}

export interface PropertyState {
  properties: Record<string, Property>;
  searchResults: Property[];
  selectedProperty: string | null;
  nearbyRadius: number;
}

const initialState: PropertyState = {
  properties: {},
  searchResults: [],
  selectedProperty: null,
  nearbyRadius: 50
};

export const [propertyState, setPropertyState] = createStore<PropertyState>(initialState);

export const propertyActions = {
  searchByAddress(address: string): Property[] {
    return Object.values(propertyState.properties).filter(
      p => p.address.toLowerCase().includes(address.toLowerCase())
    );
  },
  
  searchByOwner(citizenId: string): Property[] {
    return Object.values(propertyState.properties).filter(
      p => p.currentOwner.citizenId.toLowerCase() === citizenId.toLowerCase()
    );
  },
  
  searchByOwnerName(name: string): Property[] {
    return Object.values(propertyState.properties).filter(
      p => p.currentOwner.name.toLowerCase().includes(name.toLowerCase())
    );
  },
  
  whoLivesThere(address: string): Property | null {
    return Object.values(propertyState.properties).find(
      p => p.address.toLowerCase() === address.toLowerCase()
    ) || null;
  },
  
  findNearby(x: number, y: number, z: number, radius: number = propertyState.nearbyRadius): Property[] {
    return Object.values(propertyState.properties).filter(p => {
      const distance = Math.sqrt(
        Math.pow(p.coordinates.x - x, 2) +
        Math.pow(p.coordinates.y - y, 2) +
        Math.pow(p.coordinates.z - z, 2)
      );
      return distance <= radius;
    }).sort((a, b) => {
      const distA = Math.sqrt(
        Math.pow(a.coordinates.x - x, 2) +
        Math.pow(a.coordinates.y - y, 2) +
        Math.pow(a.coordinates.z - z, 2)
      );
      const distB = Math.sqrt(
        Math.pow(b.coordinates.x - x, 2) +
        Math.pow(b.coordinates.y - y, 2) +
        Math.pow(b.coordinates.z - z, 2)
      );
      return distA - distB;
    });
  },
  
  findBusinessesByType(type: string): Property[] {
    return Object.values(propertyState.properties).filter(
      p => p.type === 'BUSINESS' && 
           p.businessType?.toLowerCase().includes(type.toLowerCase())
    );
  },
  
  register(
    address: string,
    type: PropertyType,
    ownerId: string,
    ownerName: string,
    coordinates: { x: number; y: number; z: number },
    businessType?: string,
    businessName?: string
  ): Property {
    const propertyId = `PROP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const property: Property = {
      propertyId,
      address,
      type,
      currentOwner: {
        citizenId: ownerId,
        name: ownerName
      },
      businessType,
      businessName,
      coordinates,
      registeredAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    
    setPropertyState('properties', propertyId, property);
    return property;
  },
  
  transfer(propertyId: string, newOwnerId: string, newOwnerName: string): boolean {
    const property = propertyState.properties[propertyId];
    if (!property) return false;
    
    setPropertyState('properties', propertyId, {
      ...property,
      currentOwner: {
        citizenId: newOwnerId,
        name: newOwnerName
      },
      lastUpdated: new Date().toISOString()
    });
    
    return true;
  },
  
  updateBusiness(
    propertyId: string,
    businessType?: string,
    businessName?: string
  ): boolean {
    const property = propertyState.properties[propertyId];
    if (!property || property.type !== 'BUSINESS') return false;
    
    setPropertyState('properties', propertyId, {
      ...property,
      businessType: businessType || property.businessType,
      businessName: businessName || property.businessName,
      lastUpdated: new Date().toISOString()
    });
    
    return true;
  },
  
  getAll(): Property[] {
    return Object.values(propertyState.properties);
  },
  
  getAllBusinesses(): Property[] {
    return Object.values(propertyState.properties).filter(p => p.type === 'BUSINESS');
  },
  
  getAllResidences(): Property[] {
    return Object.values(propertyState.properties).filter(
      p => p.type === 'HOUSE' || p.type === 'APARTMENT'
    );
  },
  
  selectProperty(propertyId: string | null) {
    setPropertyState('selectedProperty', propertyId);
  },
  
  search(query: string) {
    const results = Object.values(propertyState.properties).filter(
      p => 
        p.address.toLowerCase().includes(query.toLowerCase()) ||
        p.currentOwner.name.toLowerCase().includes(query.toLowerCase()) ||
        p.currentOwner.citizenId.toLowerCase().includes(query.toLowerCase()) ||
        (p.businessName && p.businessName.toLowerCase().includes(query.toLowerCase())) ||
        (p.businessType && p.businessType.toLowerCase().includes(query.toLowerCase()))
    );
    setPropertyState('searchResults', results);
  },
  
  setNearbyRadius(radius: number) {
    setPropertyState('nearbyRadius', Math.max(10, Math.min(500, radius)));
  }
};
