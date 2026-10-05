const PREFIX = 'ding_pending_';

export function pendingDingKey(userId) {
  if (!userId) throw new Error('User id is required.');
  return `${PREFIX}${userId}`;
}

export function savePendingDing(storage, userId, pending) {
  if (!pending?.request?.p_event_id || !pending?.request?.p_character_id) {
    throw new Error('Pending Ding requires a stable event and character id.');
  }

  const payload = {
    ...pending,
    actorId: userId,
    savedAt: pending.savedAt || new Date().toISOString(),
  };
  storage.setItem(pendingDingKey(userId), JSON.stringify(payload));
  return payload;
}

export function readPendingDing(storage, userId) {
  try {
    const parsed = JSON.parse(storage.getItem(pendingDingKey(userId)) || 'null');
    if (!parsed || parsed.actorId !== userId) return null;
    if (!parsed.request?.p_event_id || !parsed.request?.p_character_id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingDing(storage, userId) {
  storage.removeItem(pendingDingKey(userId));
}

export async function checkPendingDing(pending, findEvent) {
  if (!pending?.request?.p_event_id) return { status: 'invalid', event: null };
  const event = await findEvent(pending.request.p_event_id, pending.actorId);
  return event ? { status: 'committed', event } : { status: 'unconfirmed', event: null };
}

export async function retryPendingDing(pending, recordDing) {
  if (!pending?.request?.p_event_id) throw new Error('Pending Ding is invalid.');
  return recordDing({ ...pending.request });
}
