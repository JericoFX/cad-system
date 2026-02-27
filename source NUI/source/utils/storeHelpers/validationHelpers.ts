/**
 * Validation Helpers
 * 
 * Utility functions for data validation
 */

/**
 * Validate a field based on rules
 * @param value The value to validate
 * @param rules The validation rules
 * @returns Validation result
 */
export function validateField(
  value: string | null, 
  rules: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    blockedValues?: string[];
  }
): { valid: boolean; error?: string } {
  if (rules.required && (!value || !value.trim())) {
    return { valid: false, error: 'Field is required' };
  }
  
  if (value && rules.minLength && value.length < rules.minLength) {
    return { valid: false, error: `Minimum length is ${rules.minLength}` };
  }
  
  if (value && rules.maxLength && value.length > rules.maxLength) {
    return { valid: false, error: `Maximum length is ${rules.maxLength}` };
  }
  
  if (value && rules.pattern && !rules.pattern.test(value)) {
    return { valid: false, error: 'Invalid format' };
  }
  
  if (value && rules.blockedValues?.includes(value)) {
    return { valid: false, error: 'Value not allowed' };
  }
  
  return { valid: true };
}

/**
 * Validate a callsign
 * @param callsign The callsign to validate
 * @param policy Validation policy
 * @returns Validation result
 */
export function validateCallsign(
  callsign: string | null,
  policy?: { 
    requireWhenEmpty?: boolean; 
    blockedPrefixes?: string[];
    minLength?: number;
    maxLength?: number;
  }
): { valid: boolean; error?: string } {
  const requireWhenEmpty = policy?.requireWhenEmpty !== false;
  
  if (!callsign || !callsign.trim()) {
    return requireWhenEmpty 
      ? { valid: false, error: 'Callsign is required' }
      : { valid: true };
  }

  const normalized = callsign.toUpperCase().trim();
  
  // Length validation
  const minLength = policy?.minLength || 1;
  const maxLength = policy?.maxLength || 10;
  
  if (normalized.length < minLength) {
    return { valid: false, error: `Callsign must be at least ${minLength} characters` };
  }
  
  if (normalized.length > maxLength) {
    return { valid: false, error: `Callsign must be no more than ${maxLength} characters` };
  }
  
  // Blocked prefixes validation
  const blockedPrefixes = Array.isArray(policy?.blockedPrefixes) 
    ? policy.blockedPrefixes 
    : [];
    
  if (blockedPrefixes.length > 0) {
    const hasBlockedPrefix = blockedPrefixes.some(prefix => 
      normalized.startsWith(prefix.toUpperCase())
    );
    
    if (hasBlockedPrefix) {
      return { valid: false, error: 'Callsign contains blocked prefix' };
    }
  }
  
  return { valid: true };
}

/**
 * Validate required fields in an object
 * @param obj The object to validate
 * @param requiredFields The fields that are required
 * @returns Validation result
 */
export function validateRequiredFields<T>(
  obj: T, 
  requiredFields: (keyof T)[]
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  
  for (const field of requiredFields) {
    const value = obj[field];
    if (value === undefined || value === null || value === '') {
      errors[field as string] = `${String(field)} is required`;
    }
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}