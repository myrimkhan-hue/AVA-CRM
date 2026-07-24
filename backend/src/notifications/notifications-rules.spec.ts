import { TransportationStatus } from '@prisma/client';
import { isDealStalled, isTransportationOverdue } from './notifications-rules';

describe('isTransportationOverdue', () => {
  const today = new Date('2026-07-24T00:00:00.000Z');

  it('не просрочена, если плановая дата не задана', () => {
    expect(isTransportationOverdue(TransportationStatus.IN_TRANSIT, null, today)).toBe(false);
  });

  it('не просрочена, если план ещё не наступил', () => {
    const planned = new Date('2026-07-25T00:00:00.000Z');
    expect(isTransportationOverdue(TransportationStatus.IN_TRANSIT, planned, today)).toBe(false);
  });

  it('просрочена, если план уже прошёл, а статус не финальный', () => {
    const planned = new Date('2026-07-23T00:00:00.000Z');
    expect(isTransportationOverdue(TransportationStatus.IN_TRANSIT, planned, today)).toBe(true);
  });

  it('не просрочена, если статус уже финальный (Доставлен)', () => {
    const planned = new Date('2026-07-23T00:00:00.000Z');
    expect(isTransportationOverdue(TransportationStatus.DELIVERED, planned, today)).toBe(false);
  });

  it('не просрочена, если статус уже финальный (Закрыта)', () => {
    const planned = new Date('2026-07-23T00:00:00.000Z');
    expect(isTransportationOverdue(TransportationStatus.CLOSED, planned, today)).toBe(false);
  });
});

describe('isDealStalled', () => {
  const today = new Date('2026-07-24T12:00:00.000Z');

  it('не зависла, если с последнего изменения прошло меньше порога', () => {
    const since = new Date('2026-07-23T12:00:00.000Z');
    expect(isDealStalled(since, today, 3)).toBe(false);
  });

  it('зависла ровно на пороге в N дней', () => {
    const since = new Date('2026-07-21T12:00:00.000Z');
    expect(isDealStalled(since, today, 3)).toBe(true);
  });

  it('зависла, если прошло больше порога', () => {
    const since = new Date('2026-07-01T00:00:00.000Z');
    expect(isDealStalled(since, today, 3)).toBe(true);
  });
});
