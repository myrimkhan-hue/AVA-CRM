export const TRANSPORTATION_STATUSES = ['REQUEST_ACCEPTED', 'CARGO_PICKED', 'IN_TRANSIT', 'CUSTOMS', 'DELIVERED', 'CLOSED'] as const;
export type TransportationStatus = (typeof TRANSPORTATION_STATUSES)[number];
export type TransportMode = 'AUTO' | 'RAIL' | 'SEA' | 'AIR' | 'MULTIMODAL';
export type LegMode = Exclude<TransportMode, 'MULTIMODAL'> | 'BROKER';
export type LegStatus = 'WAITING' | 'IN_PROGRESS' | 'DONE';

export const STATUS_COLORS: Record<TransportationStatus, { background: string; color: string }> = {
  REQUEST_ACCEPTED: { background: 'var(--indigo-soft)', color: 'var(--indigo-fg)' },
  CARGO_PICKED: { background: 'var(--teal-soft)', color: 'var(--teal-fg)' },
  IN_TRANSIT: { background: 'var(--amber-soft)', color: 'var(--amber-fg)' },
  CUSTOMS: { background: 'var(--purple-soft)', color: 'var(--purple-fg)' },
  DELIVERED: { background: 'var(--green-soft)', color: 'var(--green-fg)' },
  CLOSED: { background: 'var(--card2)', color: 'var(--text3)' },
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
