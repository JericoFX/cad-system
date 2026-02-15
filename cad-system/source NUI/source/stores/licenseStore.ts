
import { createStore } from 'solid-js/store';

export type LicenseType = 'WEAPON' | 'DRIVING' | 'BUSINESS' | 'SPECIAL';

export interface License {
  licenseId: string;
  type: LicenseType;
  category: string;
  holderId: string;
  holderName: string;
  issuedBy: string;
  issuedAt: string;
  status: 'ACTIVE' | 'REVOKED' | 'PENDING';
  revokedReason?: string;
  revokedBy?: string;
  revokedAt?: string;
}

export interface LicenseState {
  licenses: Record<string, License>;
  searchResults: License[];
  selectedLicense: string | null;
}

const initialState: LicenseState = {
  licenses: {},
  searchResults: [],
  selectedLicense: null
};

export const [licenseState, setLicenseState] = createStore<LicenseState>(initialState);

export const LICENSE_TYPES: Record<string, { type: LicenseType; category: string }> = {
  'W-1': { type: 'WEAPON', category: 'Armas pequeñas' },
  'W-2': { type: 'WEAPON', category: 'Escopetas' },
  'W-3': { type: 'WEAPON', category: 'Rifles' },
  'W-4': { type: 'WEAPON', category: 'Automáticas (PD/SWAT)' },
  'D-A': { type: 'DRIVING', category: 'Automóviles livianos' },
  'D-B': { type: 'DRIVING', category: 'Vehículos pesados' },
  'D-C': { type: 'DRIVING', category: 'Motocicletas' },
  'D-D': { type: 'DRIVING', category: 'Transporte público' },
  'D-E': { type: 'DRIVING', category: 'Aéreos/Helicópteros' },
  'B-A': { type: 'BUSINESS', category: 'Licencia de funcionamiento' },
  'B-B': { type: 'BUSINESS', category: 'Venta de alcohol' },
  'B-C': { type: 'BUSINESS', category: 'Venta de armas' },
  'B-D': { type: 'BUSINESS', category: 'Seguridad privada' },
  'S-1': { type: 'SPECIAL', category: 'Pesca deportiva' },
  'S-2': { type: 'SPECIAL', category: 'Caza' },
  'S-3': { type: 'SPECIAL', category: 'Uso de explosivos' }
};

export const licenseActions = {
  searchByHolder(holderId: string): License[] {
    return Object.values(licenseState.licenses).filter(
      l => l.holderId.toLowerCase() === holderId.toLowerCase()
    );
  },
  
  searchByName(name: string): License[] {
    return Object.values(licenseState.licenses).filter(
      l => l.holderName.toLowerCase().includes(name.toLowerCase())
    );
  },
  
  verify(licenseId: string, holderId: string): { valid: boolean; license?: License } {
    const license = Object.values(licenseState.licenses).find(
      l => l.licenseId === licenseId && l.holderId.toLowerCase() === holderId.toLowerCase()
    );
    
    if (!license) {
      return { valid: false };
    }
    
    return {
      valid: license.status === 'ACTIVE',
      license
    };
  },
  
  issue(licenseId: string, holderId: string, holderName: string, issuedBy: string): License | null {
    const licenseType = LICENSE_TYPES[licenseId];
    if (!licenseType) {
      console.error(`[License] Invalid license type: ${licenseId}`);
      return null;
    }
    
    const existing = Object.values(licenseState.licenses).find(
      l => l.licenseId === licenseId && l.holderId.toLowerCase() === holderId.toLowerCase()
    );
    
    if (existing) {
      console.error(`[License] License already exists`);
      return null;
    }
    
    const license: License = {
      licenseId,
      type: licenseType.type,
      category: licenseType.category,
      holderId,
      holderName,
      issuedBy,
      issuedAt: new Date().toISOString(),
      status: 'ACTIVE'
    };
    
    const key = `${licenseId}_${holderId}`;
    setLicenseState('licenses', key, license);
    
    return license;
  },
  
  revoke(licenseId: string, holderId: string, reason: string, revokedBy: string): boolean {
    const key = `${licenseId}_${holderId}`;
    const license = licenseState.licenses[key];
    
    if (!license) {
      console.error(`[License] License not found`);
      return false;
    }
    
    setLicenseState('licenses', key, {
      ...license,
      status: 'REVOKED',
      revokedReason: reason,
      revokedBy,
      revokedAt: new Date().toISOString()
    });
    
    return true;
  },
  
  reactivate(licenseId: string, holderId: string): boolean {
    const key = `${licenseId}_${holderId}`;
    const license = licenseState.licenses[key];
    
    if (!license || license.status !== 'REVOKED') {
      return false;
    }
    
    setLicenseState('licenses', key, {
      ...license,
      status: 'ACTIVE',
      revokedReason: undefined,
      revokedBy: undefined,
      revokedAt: undefined
    });
    
    return true;
  },
  
  getByType(type: LicenseType): License[] {
    return Object.values(licenseState.licenses).filter(l => l.type === type);
  },
  
  getHolderSummary(holderId: string): {
    weapons: License[];
    driving: License[];
    business: License[];
    special: License[];
    total: number;
    active: number;
    revoked: number;
  } {
    const licenses = this.searchByHolder(holderId);
    
    return {
      weapons: licenses.filter(l => l.type === 'WEAPON'),
      driving: licenses.filter(l => l.type === 'DRIVING'),
      business: licenses.filter(l => l.type === 'BUSINESS'),
      special: licenses.filter(l => l.type === 'SPECIAL'),
      total: licenses.length,
      active: licenses.filter(l => l.status === 'ACTIVE').length,
      revoked: licenses.filter(l => l.status === 'REVOKED').length
    };
  },
  
  selectLicense(key: string | null) {
    setLicenseState('selectedLicense', key);
  },
  
  search(query: string) {
    const results = Object.values(licenseState.licenses).filter(
      l => 
        l.holderId.toLowerCase().includes(query.toLowerCase()) ||
        l.holderName.toLowerCase().includes(query.toLowerCase()) ||
        l.licenseId.toLowerCase().includes(query.toLowerCase())
    );
    setLicenseState('searchResults', results);
  }
};
