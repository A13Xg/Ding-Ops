import { renderTokens, unknownTemplateTokens } from './templateTokens.js';
import { partsFor } from './broadcastTemplate.js';

export const DEFAULT_DING_COLOR = '#5865F2';
export const DEFAULT_ACHIEVEMENT_COLOR = '#A78BFA';
export const DEFAULT_BOT_USERNAME = 'DING Control';
export const DEFAULT_DING_TITLE_TEMPLATE = '✨ {{PUSH_TITLE}}';
export const DEFAULT_DING_DESCRIPTION_TEMPLATE = '{{PUSH_BODY}}';
export const DEFAULT_ACHIEVEMENT_TITLE_TEMPLATE = '🏆 {{PUSH_TITLE}}';
export const DEFAULT_ACHIEVEMENT_DESCRIPTION_TEMPLATE = '{{PUSH_BODY}}';
export const DEFAULT_FOOTER_TEXT = 'DING';

export const DISCORD_TOKENS = {
  USER: ctx => String(ctx.username || '').trim() || 'Someone',
  CHARACTER: ctx => String(ctx.characterName || '').trim() || 'Unknown Character',
  LEVEL: ctx => (Number.isFinite(Number(ctx.level)) ? String(Number(ctx.level)) : ''),
  CLASS: ctx => String(ctx.className || '').trim(),
  SPEC: ctx => String(ctx.spec || '').trim(),
  REALM: ctx => String(ctx.realm || '').trim(),
  ZONE: ctx => String(ctx.zone || '').trim(),
  ACTIVITY: ctx => String(ctx.activity || '').trim(),
  NOTE: ctx => String(ctx.note || '').trim(),
  DATE: ctx => partsFor(ctx.sentAt, ctx.timeZone).date,
  TIME: ctx => partsFor(ctx.sentAt, ctx.timeZone).time,
  ACHIEVEMENT: ctx => String(ctx.achievementName || '').trim(),
  TIER: ctx => (ctx.tier ? String(ctx.tier).replace(/\b\w/g, c => c.toUpperCase()) : ''),
  POINTS: ctx => (Number.isFinite(ctx.points) ? String(ctx.points) : ''),
  PUSH_TITLE: ctx => String(ctx.pushTitle || ''),
  PUSH_BODY: ctx => String(ctx.pushBody || ''),
};

export function renderDiscordTemplate(template, context = {}) {
  return renderTokens(DISCORD_TOKENS, template, context);
}

export function unknownDiscordTokens(template) {
  return unknownTemplateTokens(DISCORD_TOKENS, template, {
    username: 'x',
    characterName: 'x',
    level: 90,
    className: 'Mage',
    spec: 'Arcane',
    realm: 'Example',
    zone: 'Harandar',
    activity: 'questing',
    note: 'x',
    achievementName: 'x',
    tier: 'bronze',
    points: 0,
    pushTitle: 'x',
    pushBody: 'x',
  });
}

export function describeDiscordTokens() {
  return [
    { token: '{{USER}}', hint: 'the DING account that recorded the event' },
    { token: '{{CHARACTER}}', hint: 'the character that leveled' },
    { token: '{{LEVEL}}', hint: 'the destination character level' },
    { token: '{{CLASS}}', hint: 'character class' },
    { token: '{{SPEC}}', hint: 'character specialization, when recorded' },
    { token: '{{REALM}}', hint: 'character realm' },
    { token: '{{ZONE}}', hint: 'zone recorded with the Ding' },
    { token: '{{ACTIVITY}}', hint: 'activity type recorded with the Ding' },
    { token: '{{NOTE}}', hint: "the Ding's attached note, blank if none" },
    { token: '{{DATE}}', hint: 'event date' },
    { token: '{{TIME}}', hint: 'event time' },
    { token: '{{ACHIEVEMENT}}', hint: 'the unlocked achievement display name' },
    { token: '{{TIER}}', hint: 'the achievement tier' },
    { token: '{{POINTS}}', hint: "the achievement's point value" },
    { token: '{{PUSH_TITLE}}', hint: 'the exact title used for mobile push' },
    { token: '{{PUSH_BODY}}', hint: 'the exact body used for mobile push' },
  ];
}

export function hexToDiscordColor(hex) {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(String(hex || '').trim());
  return match ? parseInt(match[1], 16) : null;
}

export function badgeImageUrl(_tier, siteUrl) {
  const base = String(siteUrl || '').replace(/\/$/, '');
  return base ? `${base}/ding-icon.svg` : null;
}

export function buildDingDiscordPayload(ctx, settings = {}) {
  const title = renderDiscordTemplate(settings.ding_title_template || DEFAULT_DING_TITLE_TEMPLATE, ctx);
  const description = renderDiscordTemplate(settings.ding_description_template || DEFAULT_DING_DESCRIPTION_TEMPLATE, ctx);
  const fields = [
    ['Character', DISCORD_TOKENS.CHARACTER(ctx)],
    ['Level', DISCORD_TOKENS.LEVEL(ctx)],
    ['Class', DISCORD_TOKENS.CLASS(ctx)],
    ['Spec', DISCORD_TOKENS.SPEC(ctx)],
    ['Realm', DISCORD_TOKENS.REALM(ctx)],
    ['Zone', DISCORD_TOKENS.ZONE(ctx)],
    ['Activity', DISCORD_TOKENS.ACTIVITY(ctx)],
  ].filter(([, value]) => String(value || '').trim()).map(([name, value]) => ({ name, value: String(value), inline: true }));
  return assemblePayload(settings, {
    title,
    description,
    color: hexToDiscordColor(settings.ding_color) ?? hexToDiscordColor(DEFAULT_DING_COLOR),
    fields,
    thumbnailUrl: null,
    sentAt: ctx.sentAt,
  });
}

export function buildAchievementDiscordPayload(ctx, settings = {}) {
  const title = renderDiscordTemplate(settings.achievement_title_template || DEFAULT_ACHIEVEMENT_TITLE_TEMPLATE, ctx);
  const description = renderDiscordTemplate(settings.achievement_description_template || DEFAULT_ACHIEVEMENT_DESCRIPTION_TEMPLATE, ctx);
  const fields = [];
  if (ctx.tier) fields.push({ name: 'Tier', value: DISCORD_TOKENS.TIER(ctx), inline: true });
  if (Number.isFinite(ctx.points)) fields.push({ name: 'Points', value: String(ctx.points), inline: true });
  const color = hexToDiscordColor(settings.achievement_color) ?? hexToDiscordColor(ctx.accent) ?? hexToDiscordColor(DEFAULT_ACHIEVEMENT_COLOR);
  const thumbnailUrl = settings.include_thumbnail === false ? null : badgeImageUrl(ctx.tier, ctx.siteUrl);
  return assemblePayload(settings, { title, description, color, fields, thumbnailUrl, sentAt: ctx.sentAt });
}

function assemblePayload(settings, { title, description, color, fields, thumbnailUrl, sentAt }) {
  let remaining = 6000;
  const fit = (value, limit) => {
    const text = String(value || '').slice(0, Math.min(limit, remaining));
    remaining -= text.length;
    return text;
  };
  const safeTitle = fit(title, 256);
  const safeDescription = fit(description, 4096);
  const safeFields = fields.slice(0, 25).map(field => ({ ...field, name: fit(field.name, 256), value: fit(field.value, 1024) })).filter(field => field.name && field.value);
  const footer = fit(settings.footer_text || DEFAULT_FOOTER_TEXT, 2048);
  const embed = {
    title: safeTitle || undefined,
    description: safeDescription || undefined,
    color: color ?? undefined,
    fields: safeFields.length ? safeFields : undefined,
    footer: footer ? { text: footer } : undefined,
    timestamp: (sentAt instanceof Date && !Number.isNaN(sentAt.getTime()) ? sentAt : new Date()).toISOString(),
  };
  if (thumbnailUrl) embed.thumbnail = { url: thumbnailUrl };
  return {
    username: String(settings.bot_username || DEFAULT_BOT_USERNAME).slice(0, 80) || undefined,
    avatar_url: settings.bot_avatar_url || undefined,
    content: String(settings.mention_content || '').trim() || undefined,
    embeds: [embed],
    allowed_mentions: { parse: ['everyone', 'roles', 'users'] },
  };
}
