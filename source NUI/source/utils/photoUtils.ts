import { cadState } from '~/stores/cadStore';

/**
 * Get all photos associated with a person
 * @param citizenId The citizen ID of the person
 * @returns Array of photo URLs
 */
export function getPersonPhotos(citizenId: string): string[] {
  const person = cadState.persons[citizenId];
  return person?.photos || [];
}

/**
 * Get all photos associated with a vehicle
 * @param plate The license plate of the vehicle
 * @returns Array of photo URLs
 */
export function getVehiclePhotos(plate: string): string[] {
  const vehicle = cadState.vehicles[plate];
  return vehicle?.photos || [];
}

/**
 * Get a formatted display string for photo count
 * @param photos Array of photo URLs
 * @returns Formatted string like "3 photos" or "No photos"
 */
export function getPhotoCountDisplay(photos: string[]): string {
  if (!photos || photos.length === 0) {
    return 'No photos';
  }
  
  if (photos.length === 1) {
    return '1 photo';
  }
  
  return `${photos.length} photos`;
}

/**
 * Check if a person has any photos
 * @param citizenId The citizen ID of the person
 * @returns True if the person has photos, false otherwise
 */
export function personHasPhotos(citizenId: string): boolean {
  const person = cadState.persons[citizenId];
  return !!(person?.photos && person.photos.length > 0);
}

/**
 * Check if a vehicle has any photos
 * @param plate The license plate of the vehicle
 * @returns True if the vehicle has photos, false otherwise
 */
export function vehicleHasPhotos(plate: string): boolean {
  const vehicle = cadState.vehicles[plate];
  return !!(vehicle?.photos && vehicle.photos.length > 0);
}

/**
 * Get the primary photo for a person (first photo in the array)
 * @param citizenId The citizen ID of the person
 * @returns The URL of the primary photo or undefined if none exist
 */
export function getPersonPrimaryPhoto(citizenId: string): string | undefined {
  const photos = getPersonPhotos(citizenId);
  return photos.length > 0 ? photos[0] : undefined;
}

/**
 * Get the primary photo for a vehicle (first photo in the array)
 * @param plate The license plate of the vehicle
 * @returns The URL of the primary photo or undefined if none exist
 */
export function getVehiclePrimaryPhoto(plate: string): string | undefined {
  const photos = getVehiclePhotos(plate);
  return photos.length > 0 ? photos[0] : undefined;
}