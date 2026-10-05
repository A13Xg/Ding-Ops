import { describe, expect, it, vi } from 'vitest';
import {
  checkPendingDing,
  clearPendingDing,
  pendingDingKey,
  readPendingDing,
  retryPendingDing,
  savePendingDing,
} from './dingPending.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: key => map.delete(key),
  };
}

const request = {
  p_event_id: '11111111-1111-4111-8111-111111111111',
  p_character_id: 'c1',
  p_expected_from_level: 41,
};

describe('pending Ding persistence', () => {
  it('namespaces pending state per DING account', () => {
    expect(pendingDingKey('u1')).toBe('ding_pending_u1');
  });

  it('round-trips only state owned by the requested actor', () => {
    const storage = memoryStorage();
    savePendingDing(storage, 'u1', { request });

    expect(readPendingDing(storage, 'u1')).toMatchObject({
      actorId: 'u1',
      request,
    });
    expect(readPendingDing(storage, 'u2')).toBeNull();
  });

  it('clears resolved pending state', () => {
    const storage = memoryStorage();
    savePendingDing(storage, 'u1', { request });
    clearPendingDing(storage, 'u1');
    expect(readPendingDing(storage, 'u1')).toBeNull();
  });
});

describe('pending Ding recovery', () => {
  it('checks the original event id before permitting a retry decision', async () => {
    const event = { id: request.p_event_id, to_level: 42 };
    const findEvent = vi.fn().mockResolvedValue(event);

    await expect(checkPendingDing({ actorId: 'u1', request }, findEvent)).resolves.toEqual({
      status: 'committed',
      event,
    });
    expect(findEvent).toHaveBeenCalledWith(request.p_event_id, 'u1');
  });

  it('reports an unconfirmed event without inventing a new id', async () => {
    await expect(checkPendingDing({ actorId: 'u1', request }, vi.fn().mockResolvedValue(null))).resolves.toEqual({
      status: 'unconfirmed',
      event: null,
    });
  });

  it('retries the exact original RPC request', async () => {
    const recordDing = vi.fn().mockResolvedValue({ id: request.p_event_id, to_level: 42 });
    await retryPendingDing({ actorId: 'u1', request }, recordDing);
    expect(recordDing).toHaveBeenCalledTimes(1);
    expect(recordDing).toHaveBeenCalledWith(request);
  });
});
