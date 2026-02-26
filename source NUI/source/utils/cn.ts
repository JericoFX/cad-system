export function cn(...inputs: (string | undefined | null | false | 0)[]): string {
  return inputs.filter(Boolean).join(' ');
}

export type ClassValue = string | undefined | null | false | 0 | ClassValue[];

export function clsx(...inputs: ClassValue[]): string {
  const classes: string[] = [];
  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === 'string') {
      classes.push(input);
    } else if (Array.isArray(input)) {
      classes.push(...input.filter((item): item is string => typeof item === 'string' && item.length > 0));
    }
  }
  return classes.join(' ');
}
