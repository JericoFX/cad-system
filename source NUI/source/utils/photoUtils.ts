import { cadState } from '~/stores/cadStore';

export function getPersonPhotos(citizenId: string): string[] {
  const person = cadState.persons[citizenId];
  return person?.photos || [];
}

export function getVehiclePhotos(plate: string): string[] {
  const vehicle = cadState.vehicles[plate];
  return vehicle?.photos || [];
}

export function getPhotoCountDisplay(photos: string[]): string {
  if (!photos || photos.length === 0) {
    return 'No photos';
  }

  if (photos.length === 1) {
    return '1 photo';
  }

  return `${photos.length} photos`;
}

export function personHasPhotos(citizenId: string): boolean {
  const person = cadState.persons[citizenId];
  return !!(person?.photos && person.photos.length > 0);
}

export function vehicleHasPhotos(plate: string): boolean {
  const vehicle = cadState.vehicles[plate];
  return !!(vehicle?.photos && vehicle.photos.length > 0);
}

export function getPersonPrimaryPhoto(citizenId: string): string | undefined {
  const photos = getPersonPhotos(citizenId);
  return photos.length > 0 ? photos[0] : undefined;
}

export function getVehiclePrimaryPhoto(plate: string): string | undefined {
  const photos = getVehiclePhotos(plate);
  return photos.length > 0 ? photos[0] : undefined;
}
