import { describe, expect, it, vi } from 'vitest';

import {
  FIRST_REMINDER_DELAY_MS,
  MIN_REMINDER_INTERVAL_MS,
  REMINDER_WINDOW_MS,
  REMINDER_CALL_TO_ACTION,
  INACTIVITY_MESSAGE_CATALOG,
  inactivityReminderStorageKey,
  isInactivityReminderDue,
  loadInactivityReminderState,
  markInactivityReminderSent,
  nextInactivityReminderDelayMs,
  pickInactivityReminderMessage,
  reconcileInactivityReminderState,
  saveInactivityReminderState,
} from './inactivityReminder.js';

function iso(ms) {
  return new Date(ms).toISOString();
}

describe('inactivity reminder scheduling', () => {
  it('schedules first reminder once per Ding cycle and keeps persisted timestamp', () => {
    const dingMs = Date.UTC(2026, 0, 1, 0, 0, 0);
    const now = dingMs + 53 * 60 * 60 * 1000;
    const first = reconcileInactivityReminderState({ latestDingAt: iso(dingMs), state: null, now, random: () => 0.5 });
    expect(first?.cycleDingAt).toBe(iso(dingMs));
    const firstScheduledMs = new Date(first.scheduledFor).getTime();
    expect(firstScheduledMs).toBeGreaterThanOrEqual(dingMs + FIRST_REMINDER_DELAY_MS);
    expect(firstScheduledMs).toBeLessThanOrEqual(dingMs + FIRST_REMINDER_DELAY_MS + REMINDER_WINDOW_MS);

    const second = reconcileInactivityReminderState({
      latestDingAt: iso(dingMs),
      state: first,
      now: now + 10_000,
      random: () => 0,
    });
    expect(second?.scheduledFor).toBe(first?.scheduledFor);
  });

  it('resets reminder cycle when a new Ding timestamp appears', () => {
    const firstDingMs = Date.UTC(2026, 0, 1, 0, 0, 0);
    const secondDingMs = firstDingMs + 80 * 60 * 60 * 1000;
    const stale = {
      cycleDingAt: iso(firstDingMs),
      lastSentAt: iso(firstDingMs + 60 * 60 * 1000),
      scheduledFor: iso(firstDingMs + 70 * 60 * 60 * 1000),
      lastMessageIndex: 2,
    };

    const reconciled = reconcileInactivityReminderState({
      latestDingAt: iso(secondDingMs),
      state: stale,
      now: secondDingMs,
      random: () => 0,
    });

    expect(reconciled).toEqual({
      cycleDingAt: iso(secondDingMs),
      lastSentAt: null,
      scheduledFor: iso(secondDingMs + FIRST_REMINDER_DELAY_MS),
      lastMessageIndex: null,
    });
  });

  it('enforces one reminder per rolling 24 hours and schedules the next randomized window', () => {
    const dingMs = Date.UTC(2026, 0, 1, 0, 0, 0);
    const dueAt = dingMs + FIRST_REMINDER_DELAY_MS;
    const state = {
      cycleDingAt: iso(dingMs),
      lastSentAt: null,
      scheduledFor: iso(dueAt),
    };

    expect(isInactivityReminderDue(state, iso(dingMs), dueAt)).toBe(true);
    const sent = markInactivityReminderSent(state, { now: dueAt, random: () => 0.25 });
    expect(isInactivityReminderDue(sent, iso(dingMs), dueAt + MIN_REMINDER_INTERVAL_MS - 1)).toBe(false);
    const nextMs = new Date(sent.scheduledFor).getTime();
    expect(nextMs).toBeGreaterThanOrEqual(dueAt + MIN_REMINDER_INTERVAL_MS);
    expect(nextMs).toBeLessThanOrEqual(dueAt + MIN_REMINDER_INTERVAL_MS + REMINDER_WINDOW_MS);
  });

  it('returns no schedule when there is no successful Ding yet', () => {
    expect(reconcileInactivityReminderState({ latestDingAt: null, state: null })).toBeNull();
  });
});

describe('inactivity reminder storage', () => {
  it('loads and saves per-user reminder state', () => {
    const storage = {
      values: new Map(),
      getItem: vi.fn(key => storage.values.get(key) ?? null),
      setItem: vi.fn((key, value) => storage.values.set(key, value)),
      removeItem: vi.fn(key => storage.values.delete(key)),
    };
    const state = {
      cycleDingAt: iso(Date.UTC(2026, 0, 1, 0, 0, 0)),
      lastSentAt: null,
      scheduledFor: iso(Date.UTC(2026, 0, 3, 4, 0, 0)),
      lastMessageIndex: 2,
    };

    saveInactivityReminderState(storage, 'user-1', state);
    expect(storage.setItem).toHaveBeenCalledWith(inactivityReminderStorageKey('user-1'), JSON.stringify(state));
    expect(loadInactivityReminderState(storage, 'user-1')).toEqual(state);

    saveInactivityReminderState(storage, 'user-1', null);
    expect(storage.removeItem).toHaveBeenCalledWith(inactivityReminderStorageKey('user-1'));
  });

  it('uses short polling delay for due reminders and minute cadence otherwise', () => {
    expect(nextInactivityReminderDelayMs({ scheduledFor: iso(Date.now() - 1_000) }, Date.now())).toBe(1_000);
    expect(nextInactivityReminderDelayMs({ scheduledFor: iso(Date.now() + 10 * 60 * 1000) }, Date.now())).toBe(60_000);
  });

  it('avoids immediately repeating the previous reminder message', () => {
    const previousIndex = INACTIVITY_MESSAGE_CATALOG.findIndex(item => item.text.includes('XP bar has filed'));
    const selected = pickInactivityReminderMessage({ random: () => 0, lastMessageIndex: previousIndex });
    expect(selected.index).not.toBe(previousIndex);
    expect(typeof selected.text).toBe('string');
    expect(selected.text.length).toBeGreaterThan(0);
    expect(selected.text.endsWith(REMINDER_CALL_TO_ACTION)).toBe(true);
  });
  it('staggers reminders across a 5-7 day window measured from the last Ding', () => {
    const DAY = 24 * 60 * 60 * 1000;
    expect(FIRST_REMINDER_DELAY_MS).toBe(5 * DAY);
    expect(MIN_REMINDER_INTERVAL_MS).toBe(5 * DAY);
    expect(FIRST_REMINDER_DELAY_MS + REMINDER_WINDOW_MS).toBe(7 * DAY);

    // Different users with the same last Ding must not all fire at once.
    const dingMs = Date.parse('2026-01-01T00:00:00.000Z');
    const scheduled = [0.01, 0.25, 0.5, 0.75, 0.99].map(roll =>
      Date.parse(
        reconcileInactivityReminderState({
          state: null,
          latestDingAt: iso(dingMs),
          now: dingMs,
          random: () => roll,
        }).scheduledFor
      )
    );
    for (const at of scheduled) {
      expect(at).toBeGreaterThanOrEqual(dingMs + 5 * DAY);
      expect(at).toBeLessThanOrEqual(dingMs + 7 * DAY);
    }
    expect(new Set(scheduled).size).toBe(scheduled.length);
  });
  /*
   * Regression: state read back from Postgres is serialised as
   * "…12:00:00.123456+00:00", not "…12:00:00.123Z". A string comparison against
   * Date#toISOString() is false for every such row, which silently wiped
   * lastSentAt and re-fired the reminder on every scheduled dispatch — 144
   * pushes a day per lapsed user at a 10-minute cadence.
   */
  it('preserves state across a PostgreSQL timestamptz round trip', () => {
    const pg = '2026-08-25T12:00:00.123456+00:00';
    const now = Date.parse('2026-09-08T12:00:00Z');
    const state = {
      cycleDingAt: pg,
      scheduledFor: '2026-09-20T00:00:00+00:00',
      lastSentAt: '2026-09-08T11:50:00+00:00',
      lastMessageIndex: 3,
    };

    const reconciled = reconcileInactivityReminderState({ state, latestDingAt: pg, now });
    expect(Date.parse(reconciled.lastSentAt)).toBe(Date.parse(state.lastSentAt));
    expect(reconciled.lastMessageIndex).toBe(3);
    expect(isInactivityReminderDue(reconciled, pg, now)).toBe(false);
  });

  it('sends a lapsed user exactly one reminder across repeated dispatch runs', () => {
    const pg = '2026-08-25T12:00:00.123456+00:00';
    const start = Date.parse('2026-09-08T12:00:00Z');
    let state = { cycleDingAt: pg, scheduledFor: null, lastSentAt: null, lastMessageIndex: null };
    let sent = 0;

    // Two hours of a 10-minute cron, with the database re-serialising each write.
    for (let tick = 0; tick < 12; tick += 1) {
      const now = start + tick * 10 * 60 * 1000;
      const reconciled = reconcileInactivityReminderState({ state, latestDingAt: pg, now });
      if (isInactivityReminderDue(reconciled, pg, now)) {
        sent += 1;
        state = { ...markInactivityReminderSent(reconciled, { now }), cycleDingAt: pg };
      } else {
        state = reconciled;
      }
    }

    expect(sent).toBe(1);
    // The follow-up must land 5-7 days out, not minutes later.
    expect(Date.parse(state.scheduledFor)).toBeGreaterThanOrEqual(start + FIRST_REMINDER_DELAY_MS);
  });
});
