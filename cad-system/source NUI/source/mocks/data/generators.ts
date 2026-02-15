export function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

export function randomDate(daysAgo: number = 30): string {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  return date.toISOString();
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomPhone(): string {
  return `555-${String(randomInt(1000, 9999)).padStart(4, '0')}`;
}

export function randomCoords(): { x: number; y: number; z: number } {
  return {
    x: randomInt(-2000, 2000) + Math.random(),
    y: randomInt(-2000, 2000) + Math.random(),
    z: randomInt(0, 100) + Math.random(),
  };
}

export const CASE_TYPES = ['THEFT', 'ASSAULT', 'HOMICIDE', 'ACCIDENT', 'DRUGS', 'TRAFFIC', 'DOMESTIC', 'FRAUD'];

export const CALL_TYPES = ['911', 'PANIC_BUTTON', 'OFFICER_REQUEST', 'WITNESS_REPORT', 'AUTOMATIC_ALERT'];

export const LOCATIONS = [
  'Downtown District',
  'Industrial Zone',
  'Residential Area',
  'Shopping Mall',
  'Hospital',
  'Police Station',
  'Highway 68',
  'Pillbox Hill',
  'Vespucci Beach',
  'Rockford Hills',
  'La Mesa',
  'Strawberry',
  'Mission Row',
];

export const STREETS = [
  'Vinewood Blvd',
  'Mission Row',
  'Popular St',
  'Innocence Blvd',
  'San Andreas Ave',
  'Power St',
  'Alta St',
  'Strawberry Ave',
  'Davis Ave',
  'Grove St',
];

export const VEHICLE_MODELS = [
  { model: 'adder', class: 'super', manufacturer: 'Truffade' },
  { model: 'bullet', class: 'super', manufacturer: 'Vapid' },
  { model: 'cheetah', class: 'super', manufacturer: 'Grotti' },
  { model: 'entityxf', class: 'super', manufacturer: 'Överflöd' },
  { model: 'zentorno', class: 'super', manufacturer: 'Pegassi' },
  { model: 'cruiser', class: 'motorcycle', manufacturer: 'Western' },
  { model: 'bati', class: 'motorcycle', manufacturer: 'Pegassi' },
  { model: 'sanchez', class: 'motorcycle', manufacturer: 'Maibatsu' },
  { model: 'police', class: 'emergency', manufacturer: 'Vapid' },
  { model: 'police2', class: 'emergency', manufacturer: 'Brute' },
  { model: 'ambulance', class: 'emergency', manufacturer: 'Brute' },
  { model: 'firetruk', class: 'emergency', manufacturer: 'MTL' },
];
