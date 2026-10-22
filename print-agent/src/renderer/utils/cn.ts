export type ClassValue = string | number | boolean | undefined | null;

export function cn(...inputs: (ClassValue | ClassValue[])[]): string {
  return inputs
    .flat(Infinity as any)
    .filter(Boolean)
    .join(' ');
}
