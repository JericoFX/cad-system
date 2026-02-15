import type { Vehicle } from '~/stores/cadStore';
import { randomChoice, randomInt } from './generators';

const COLORS = ['Black', 'White', 'Red', 'Blue', 'Silver', 'Gray', 'Green', 'Yellow', 'Orange', 'Brown'];

const VEHICLE_DATA = [
  { model: 'adder', make: 'Truffade', year: 2022 },
  { model: 'bullet', make: 'Vapid', year: 2021 },
  { model: 'cheetah', make: 'Grotti', year: 2023 },
  { model: 'entityxf', make: 'Överflöd', year: 2022 },
  { model: 'zentorno', make: 'Pegassi', year: 2023 },
  { model: 't20', make: 'Progen', year: 2022 },
  { model: 'osiris', make: 'Pegassi', year: 2021 },
  { model: 'turismor', make: 'Grotti', year: 2022 },
  { model: 'vacca', make: 'Pegassi', year: 2020 },
  { model: 'infernus', make: 'Pegassi', year: 2021 },
  { model: 'cruiser', make: 'Western', year: 2020 },
  { model: 'bati', make: 'Pegassi', year: 2021 },
  { model: 'sanchez', make: 'Maibatsu', year: 2019 },
  { model: 'ruffian', make: 'Pegassi', year: 2020 },
  { model: 'police', make: 'Vapid', year: 2022 },
  { model: 'police2', make: 'Brute', year: 2021 },
  { model: 'police3', make: 'Vapid', year: 2023 },
  { model: 'ambulance', make: 'Brute', year: 2022 },
  { model: 'firetruk', make: 'MTL', year: 2021 },
  { model: 'speedo', make: 'Vapid', year: 2020 },
  { model: 'burrito', make: 'Declasse', year: 2019 },
  { model: 'buccaneer', make: 'Declasse', year: 1968 },
  { model: 'dominator', make: 'Vapid', year: 2015 },
  { model: 'gauntlet', make: 'Bravado', year: 2016 },
  { model: 'phoenix', make: 'Imponte', year: 1977 },
  { model: 'sultan', make: 'Karin', year: 2018 },
  { model: 'asterope', make: 'Karin', year: 2019 },
  { model: 'premier', make: 'Declasse', year: 2017 },
  { model: 'primo', make: 'Albany', year: 2018 },
  { model: 'oracle', make: 'Übermacht', year: 2020 },
  { model: 'cavalcade', make: 'Albany', year: 2019 },
  { model: 'granger', make: 'Declasse', year: 2020 },
  { model: 'landstalker', make: 'Dundreary', year: 2018 },
  { model: 'huntley', make: 'Enus', year: 2021 },
];

function generatePlate(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  
  const part1 = Array.from({ length: 3 }, () => letters[randomInt(0, 25)]).join('');
  const part2 = Array.from({ length: 3 }, () => numbers[randomInt(0, 9)]).join('');
  
  return `${part1}${part2}`;
}

function generateVIN(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 17 }, () => chars[randomInt(0, chars.length - 1)]).join('');
}

export function generateVehicle(ownerId?: string, ownerName?: string): Vehicle {
  const vehicleData = randomChoice(VEHICLE_DATA);
  const plate = generatePlate();
  
  return {
    plate,
    model: vehicleData.model,
    make: vehicleData.make,
    year: vehicleData.year,
    color: randomChoice(COLORS),
    ownerId: ownerId || '',
    ownerName: ownerName || '',
    vin: generateVIN(),
    registrationStatus: randomChoice(['VALID', 'SUSPENDED', 'EXPIRED']),
    insuranceStatus: randomChoice(['VALID', 'EXPIRED', 'NONE']),
    stolen: false,
    flags: [],
    createdAt: new Date().toISOString(),
  };
}

export function generateVehicles(count: number, ownerData?: { id: string; name: string }[]): Record<string, Vehicle> {
  const vehicles: Record<string, Vehicle> = {};
  
  for (let i = 0; i < count; i++) {
    const owner = ownerData?.[i];
    const vehicle = generateVehicle(owner?.id, owner?.name);
    vehicles[vehicle.plate] = vehicle;
  }
  
  return vehicles;
}

export const MOCK_VEHICLES: Record<string, Vehicle> = {
  'ABC123': {
    plate: 'ABC123',
    model: 'sultan',
    make: 'Karin',
    year: 2018,
    color: 'Blue',
    ownerId: 'CID001',
    ownerName: 'John Doe',
    vin: '1HGBH41JXMN109186',
    registrationStatus: 'VALID',
    insuranceStatus: 'VALID',
    stolen: false,
    flags: [],
    createdAt: '2023-01-01T00:00:00Z',
  },
  'XYZ789': {
    plate: 'XYZ789',
    model: 'dominator',
    make: 'Vapid',
    year: 2015,
    color: 'Red',
    ownerId: 'CID003',
    ownerName: 'Michael Johnson',
    vin: '2FMDK4GC0BBB12345',
    registrationStatus: 'VALID',
    insuranceStatus: 'VALID',
    stolen: false,
    flags: ['SUSPICIOUS_ACTIVITY'],
    createdAt: '2023-01-01T00:00:00Z',
  },
  'BOLO001': {
    plate: 'BOLO001',
    model: 'speedo',
    make: 'Vapid',
    year: 2020,
    color: 'White',
    ownerId: '',
    ownerName: '',
    vin: '3VWFE21C04M000001',
    registrationStatus: 'SUSPENDED',
    insuranceStatus: 'EXPIRED',
    stolen: true,
    stolenReportedAt: '2024-01-10T00:00:00Z',
    flags: ['BOLO', 'WANTED', 'ARMED_AND_DANGEROUS'],
    createdAt: '2023-01-01T00:00:00Z',
  },
  'EMS001': {
    plate: 'EMS001',
    model: 'ambulance',
    make: 'Brute',
    year: 2022,
    color: 'White',
    ownerId: 'EMS_DEPT',
    ownerName: 'EMS Department',
    vin: '4T1BE46K19U000001',
    registrationStatus: 'VALID',
    insuranceStatus: 'VALID',
    stolen: false,
    flags: ['EMERGENCY_VEHICLE'],
    createdAt: '2023-01-01T00:00:00Z',
  },
  'POL001': {
    plate: 'POL001',
    model: 'police',
    make: 'Vapid',
    year: 2022,
    color: 'Black',
    ownerId: 'LSPD',
    ownerName: 'Los Santos Police Department',
    vin: '5Y2SL65875Z000001',
    registrationStatus: 'VALID',
    insuranceStatus: 'VALID',
    stolen: false,
    flags: ['POLICE_VEHICLE'],
    createdAt: '2023-01-01T00:00:00Z',
  },
};

export const EXTENDED_VEHICLES = generateVehicles(30);

export const ALL_VEHICLES = { ...MOCK_VEHICLES, ...EXTENDED_VEHICLES };
