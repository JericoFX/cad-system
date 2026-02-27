/**
 * Date/Time Helpers
 * 
 * Utility functions for date and time operations
 */

/**
 * Format a date as a localized date string
 * @param date The date to format
 * @returns Formatted date string
 */
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString();
}

/**
 * Format a date as a localized date and time string
 * @param date The date to format
 * @returns Formatted date and time string
 */
export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString();
}

/**
 * Format a date as a localized time string
 * @param date The date to format
 * @returns Formatted time string
 */
export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString();
}

/**
 * Check if a date is overdue based on days
 * @param date The date to check
 * @param days Number of days before considered overdue
 * @returns True if overdue, false otherwise
 */
export function isOverdue(date: string | Date, days: number): boolean {
  const dueDate = new Date(date);
  dueDate.setDate(dueDate.getDate() + days);
  return new Date() > dueDate;
}

/**
 * Calculate the age in years from a birth date
 * @param birthDate The birth date
 * @returns Age in years
 */
export function calculateAge(birthDate: string | Date): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * Add days to a date
 * @param date The date to add days to
 * @param days Number of days to add
 * @returns New date with days added
 */
export function addDays(date: string | Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Check if two dates are on the same day
 * @param date1 First date
 * @param date2 Second date
 * @returns True if same day, false otherwise
 */
export function isSameDay(date1: string | Date, date2: string | Date): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}