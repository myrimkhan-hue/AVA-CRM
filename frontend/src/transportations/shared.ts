export const TRANSPORTATION_STATUSES = ['REQUEST_ACCEPTED', 'CARGO_PICKED', 'IN_TRANSIT', 'CUSTOMS', 'DELIVERED', 'CLOSED'] as const;
export type TransportationStatus = (typeof TRANSPORTATION_STATUSES)[number];
export type TransportMode = 'AUTO' | 'RAIL' | 'SEA' | 'AIR' | 'MULTIMODAL';
export type LegMode = Exclude<TransportMode, 'MULTIMODAL'> | 'BROKER';
export type LegStatus = 'WAITING' | 'IN_PROGRESS' | 'DONE';

export const STATUS_COLORS: Record<TransportationStatus, { background: string; color: string }> = {
  REQUEST_ACCEPTED: { background: '#E7E9FD', color: '#4F46E5' },
  CARGO_PICKED: { background: '#D5F0EC', color: '#0F766E' },
  IN_TRANSIT: { background: '#FDF0D5', color: '#B45309' },
  CUSTOMS: { background: '#EFE9FD', color: '#7C3AED' },
  DELIVERED: { background: '#DCF5E4', color: '#15803D' },
  CLOSED: { background: '#EDF0F4', color: '#66707D' },
};

export const CURRENCIES = ['USD', 'KZT', 'CNY', 'RUB', 'EUR'];
export const MODES: TransportMode[] = ['AUTO', 'RAIL', 'SEA', 'AIR', 'MULTIMODAL'];
export const LEG_MODES: LegMode[] = ['AUTO', 'RAIL', 'SEA', 'AIR', 'BROKER'];

export function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== '')) as Partial<T>;
}
