import type { Person } from '~/stores/cadStore';
import { generateId, randomDate, randomPhone, randomInt, randomChoice } from './generators';

const FIRST_NAMES = [
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles',
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen', 'Nancy',
  'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua',
  'Betty', 'Helen', 'Sandra', 'Donna', 'Carol', 'Ruth', 'Sharon', 'Michelle', 'Laura', 'Sarah',
  'Alejandro', 'Maria', 'Jose', 'Carmen', 'Luis', 'Ana', 'Carlos', 'Isabella', 'Miguel', 'Sofia',
  'Wei', 'Ying', 'Li', 'Hui', 'Xia', 'Jun', 'Min', 'Huan', 'Lan', 'Fang',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes',
];

const ADDRESSES = [
  '101 Vinewood Blvd', '202 Mission Row', '303 Popular St', '404 Innocence Blvd',
  '505 San Andreas Ave', '606 Power St', '707 Alta St', '808 Strawberry Ave',
  '909 Davis Ave', '111 Grove St', '222 Elgin Ave', '333 Las Lagunas Blvd',
  '444 Cougar Ave', '555 Spanish Ave', '666 Clinton Ave', '777 Del Perro Fwy',
  '888 Palomino Ave', '999 San Vitus Blvd', '121 Liberty St', '212 Integrity Way',
];

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const GENDERS: Array<'MALE' | 'FEMALE' | 'OTHER'> = ['MALE', 'FEMALE', 'OTHER'];

export function generatePerson(): Person {
  const firstName = randomChoice(FIRST_NAMES);
  const lastName = randomChoice(LAST_NAMES);
  const citizenId = generateId('CID');

  return {
    citizenid: citizenId,
    firstName,
    lastName,
    dateOfBirth: randomDate(365 * 50),
    ssn: `${randomInt(100, 999)}-${randomInt(10, 99)}-${randomInt(1000, 9999)}`,
    gender: randomChoice(GENDERS),
    phone: randomPhone(),
    address: randomChoice(ADDRESSES),
    bloodType: randomChoice(BLOOD_TYPES),
    height: `${randomInt(5, 6)}'${randomInt(0, 11)}"`,
    weight: `${randomInt(120, 250)} lbs`,
    eyeColor: randomChoice(['Brown', 'Blue', 'Green', 'Hazel']),
    hairColor: randomChoice(['Black', 'Brown', 'Blonde', 'Red', 'Gray']),
    photo: `https://picsum.photos/seed/${citizenId}/300/400`,
    flags: [],
    createdAt: randomDate(1000),
    lastUpdated: randomDate(30),
    isDead: false,
    notes: [],
  };
}

export function generatePersons(count: number): Record<string, Person> {
  const persons: Record<string, Person> = {};

  for (let i = 0; i < count; i++) {
    const person = generatePerson();
    persons[person.citizenid] = person;
  }

  return persons;
}

export const MOCK_PERSONS: Record<string, Person> = {
  'CID001': {
    citizenid: 'CID001',
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: '1990-01-15',
    ssn: '123-45-6789',
    gender: 'MALE',
    phone: '555-0101',
    address: '101 Vinewood Blvd',
    bloodType: 'O+',
    height: "5'10\"",
    weight: '175 lbs',
    eyeColor: 'Brown',
    hairColor: 'Black',
    photo: 'https://picsum.photos/seed/CID001/300/400',
    flags: [],
    createdAt: '2023-01-01T00:00:00Z',
    lastUpdated: '2024-01-01T00:00:00Z',
    isDead: false,
    notes: [],
  },
  'CID002': {
    citizenid: 'CID002',
    firstName: 'Maria',
    lastName: 'Gonzalez',
    dateOfBirth: '1985-03-22',
    ssn: '987-65-4321',
    gender: 'FEMALE',
    phone: '555-0102',
    address: '202 Mission Row',
    bloodType: 'A-',
    height: "5'6\"",
    weight: '140 lbs',
    eyeColor: 'Brown',
    hairColor: 'Black',
    photo: 'https://picsum.photos/seed/CID002/300/400',
    flags: [],
    createdAt: '2023-01-01T00:00:00Z',
    lastUpdated: '2024-01-01T00:00:00Z',
    isDead: false,
    notes: [],
  },
  'CID003': {
    citizenid: 'CID003',
    firstName: 'Michael',
    lastName: 'Johnson',
    dateOfBirth: '1988-07-30',
    ssn: '456-78-9012',
    gender: 'MALE',
    phone: '555-0103',
    address: '303 Popular St',
    bloodType: 'B+',
    height: "6'2\"",
    weight: '200 lbs',
    eyeColor: 'Blue',
    hairColor: 'Brown',
    photo: 'https://picsum.photos/seed/CID003/300/400',
    flags: [],
    createdAt: '2023-01-01T00:00:00Z',
    lastUpdated: '2024-01-01T00:00:00Z',
    isDead: false,
    notes: [],
  },
  'CID004': {
    citizenid: 'CID004',
    firstName: 'Sarah',
    lastName: 'Chen',
    dateOfBirth: '1992-11-08',
    ssn: '789-01-2345',
    gender: 'FEMALE',
    phone: '555-0104',
    address: '404 Innocence Blvd',
    bloodType: 'AB+',
    height: "5'4\"",
    weight: '125 lbs',
    eyeColor: 'Brown',
    hairColor: 'Black',
    photo: 'https://picsum.photos/seed/CID004/300/400',
    flags: [],
    createdAt: '2023-01-01T00:00:00Z',
    lastUpdated: '2024-01-01T00:00:00Z',
    isDead: false,
    notes: [],
  },
  'CID005': {
    citizenid: 'CID005',
    firstName: 'Carlos',
    lastName: 'Rodriguez',
    dateOfBirth: '1978-05-14',
    ssn: '321-54-9876',
    gender: 'MALE',
    phone: '555-0105',
    address: '505 San Andreas Ave',
    bloodType: 'O-',
    height: "5'8\"",
    weight: '160 lbs',
    eyeColor: 'Hazel',
    hairColor: 'Brown',
    photo: 'https://picsum.photos/seed/CID005/300/400',
    flags: [],
    createdAt: '2023-01-01T00:00:00Z',
    lastUpdated: '2024-01-01T00:00:00Z',
    isDead: false,
    notes: [],
  },
};

export const EXTENDED_PERSONS = generatePersons(50);

export const ALL_PERSONS = { ...MOCK_PERSONS, ...EXTENDED_PERSONS };
