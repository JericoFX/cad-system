export function sanitizeInput(value: string): string {
  return value.replace(/[<>]/g, '');
}

export function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateNumber(value: string): number | null {
  const num = Number(value);
  return isNaN(num) ? null : num;
}
