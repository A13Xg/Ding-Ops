import { dingAchievements } from './dingAchievements.js';
import { INACTIVITY_MESSAGE_CATALOG, seedIndex } from './notificationMessages.js';
import { renderTokens, unknownTemplateTokens } from './templateTokens.js';

const achievementById = new Map(dingAchievements.map(item => [item.id, item]));

export function partsFor(date, timeZone) {
  const when = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const zone = timeZone || 'UTC';
  const pick = options => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: zone, ...options }).format(when);
    } catch {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', ...options }).format(when);
    }
  };
  return {
    date: pick({ year: 'numeric', month: '2-digit', day: '2-digit' }),
    time: pick({ hour: '2-digit', minute: '2-digit', hour12: false }),
  };
}

export const BROADCAST_TOKENS = {
  USER: ctx => String(ctx.recipient || '').trim() || 'Someone',
  SENDER: ctx => String(ctx.sender || '').trim() || 'Control',
  CREW: ctx => String(Number.isFinite(ctx.crew) ? ctx.crew : 0),
  DATE: ctx => partsFor(ctx.sentAt, ctx.timeZone).date,
  TIME: ctx => partsFor(ctx.sentAt, ctx.timeZone).time,
  REMINDER: ctx => {
    const seed = `${ctx.sentAt instanceof Date ? ctx.sentAt.toISOString() : ''}:${ctx.recipient || ''}`;
    return INACTIVITY_MESSAGE_CATALOG[seedIndex(seed, INACTIVITY_MESSAGE_CATALOG.length)].text;
  },
  ACHIEVEMENT: (ctx, arg) => achievementById.get(String(arg || '').trim())?.name ?? null,
};

export function renderBroadcast(template, context = {}) {
  return renderTokens(BROADCAST_TOKENS, template, context);
}

export function unknownTokens(template) {
  return unknownTemplateTokens(BROADCAST_TOKENS, template, { recipient: 'x', sender: 'x', crew: 0 });
}

export function describeTokens() {
  return [
    { token: '{{USER}}', hint: "the recipient's own name" },
    { token: '{{SENDER}}', hint: 'the sending admin' },
    { token: '{{CREW}}', hint: 'how many target devices were selected' },
    { token: '{{DATE}}', hint: 'send date' },
    { token: '{{TIME}}', hint: 'send time' },
    { token: '{{REMINDER}}', hint: 'a deterministic inactivity nag' },
    { token: '{{ACHIEVEMENT:first_ding}}', hint: 'a DING achievement id → display name' },
  ];
}
