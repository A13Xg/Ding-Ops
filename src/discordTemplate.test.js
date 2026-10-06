import { describe, it, expect } from 'vitest';

import {
  DISCORD_TOKENS,
  badgeImageUrl,
  buildAchievementDiscordPayload,
  buildDingDiscordPayload,
  describeDiscordTokens,
  hexToDiscordColor,
  renderDiscordTemplate,
  unknownDiscordTokens,
} from './discordTemplate.js';

const ctx = {
  username: 'AlexG',
  characterName: 'Hexlord',
  level: 84,
  className: 'Warlock',
  spec: 'Destruction',
  realm: 'Area 52',
  zone: 'Harandar',
  activity: 'questing',
  note: 'one more quest',
  sentAt: new Date('2026-10-06T17:30:00Z'),
  timeZone: 'UTC',
  achievementName: 'Dungeon Degenerate',
  tier: 'silver',
  points: 30,
  pushTitle: 'Hexlord hit 84',
  pushBody: 'Grass exposure remains unconfirmed.',
  accent: '#a78bfa',
  siteUrl: 'https://a13xg.github.io/Ding-Ops',
};

describe('discord templates', () => {
  it('fills DING domain tokens', () => {
    expect(renderDiscordTemplate('{{USER}} / {{CHARACTER}} / {{LEVEL}} / {{CLASS}} / {{REALM}}', ctx))
      .toBe('AlexG / Hexlord / 84 / Warlock / Area 52');
    expect(renderDiscordTemplate('{{ZONE}} / {{ACTIVITY}} / {{NOTE}}', ctx))
      .toBe('Harandar / questing / one more quest');
  });

  it('falls back to push copy by default', () => {
    expect(renderDiscordTemplate('{{PUSH_TITLE}} / {{PUSH_BODY}}', ctx))
      .toBe('Hexlord hit 84 / Grass exposure remains unconfirmed.');
  });

  it('reports unknown tokens and documents every supported token', () => {
    expect(unknownDiscordTokens('{{USER}} {{NOPE}}')).toEqual(['{{NOPE}}']);
    const described = describeDiscordTokens().map(item => item.token);
    for (const token of Object.keys(DISCORD_TOKENS)) {
      expect(described).toContain(`{{${token}}}`);
    }
  });

  it('bounds expanded Ding embeds to Discord field and total limits', () => {
    const payload = buildDingDiscordPayload(
      { ...ctx, note: 'n'.repeat(2000), zone: 'z'.repeat(2000) },
      {
        ding_title_template: '{{NOTE}}'.repeat(30),
        ding_description_template: '{{NOTE}}'.repeat(500),
        footer_text: 'f'.repeat(2048),
      }
    );
    const embed = payload.embeds[0];
    expect(embed.title.length).toBeLessThanOrEqual(256);
    expect(embed.description.length).toBeLessThanOrEqual(4096);
    expect(embed.footer.text.length).toBeLessThanOrEqual(2048);
    expect(embed.fields.every(field => field.value.length <= 1024)).toBe(true);
    const total =
      embed.title.length +
      embed.description.length +
      embed.footer.text.length +
      embed.fields.reduce((sum, field) => sum + field.name.length + field.value.length, 0);
    expect(total).toBeLessThanOrEqual(6000);
  });

  it('builds a Ding payload with DING defaults and useful fields', () => {
    const payload = buildDingDiscordPayload(ctx, {});
    expect(payload.embeds[0].title).toBe('✨ Hexlord hit 84');
    expect(payload.embeds[0].description).toBe('Grass exposure remains unconfirmed.');
    expect(payload.embeds[0].color).toBe(0x5865f2);
    expect(payload.embeds[0].fields).toEqual(expect.arrayContaining([
      { name: 'Character', value: 'Hexlord', inline: true },
      { name: 'Level', value: '84', inline: true },
      { name: 'Class', value: 'Warlock', inline: true },
      { name: 'Realm', value: 'Area 52', inline: true },
      { name: 'Zone', value: 'Harandar', inline: true },
    ]));
    expect(payload.username).toBe('DING Control');
    expect(payload.embeds[0].timestamp).toBe(ctx.sentAt.toISOString());
  });

  it('honours Ding template/color/bot overrides', () => {
    const payload = buildDingDiscordPayload(ctx, {
      ding_title_template: '{{CHARACTER}} sweated to {{LEVEL}}',
      ding_description_template: '{{USER}} · {{ZONE}} · {{NOTE}}',
      ding_color: '#7C3AED',
      bot_username: 'Basement Control',
      footer_text: 'DING Ops',
    });
    expect(payload.embeds[0].title).toBe('Hexlord sweated to 84');
    expect(payload.embeds[0].description).toBe('AlexG · Harandar · one more quest');
    expect(payload.embeds[0].color).toBe(0x7c3aed);
    expect(payload.username).toBe('Basement Control');
    expect(payload.embeds[0].footer.text).toBe('DING Ops');
  });

  it('builds achievement payload with tier/points and badge image', () => {
    const payload = buildAchievementDiscordPayload(ctx, {});
    expect(payload.embeds[0].title).toBe('🏆 Hexlord hit 84');
    expect(payload.embeds[0].fields).toEqual([
      { name: 'Tier', value: 'Silver', inline: true },
      { name: 'Points', value: '30', inline: true },
    ]);
    expect(payload.embeds[0].thumbnail.url).toBe('https://a13xg.github.io/Ding-Ops/badges/512/silver.png');
    expect(payload.embeds[0].color).toBe(hexToDiscordColor(ctx.accent));
  });

  it('converts colors and builds absolute badge URLs', () => {
    expect(hexToDiscordColor('#5865F2')).toBe(0x5865f2);
    expect(hexToDiscordColor('not-a-color')).toBeNull();
    expect(badgeImageUrl('gold', 'https://example.com/app/')).toBe('https://example.com/app/badges/512/gold.png');
    expect(badgeImageUrl(null, '')).toBeNull();
  });
});
