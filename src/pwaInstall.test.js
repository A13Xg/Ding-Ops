import { describe, expect, it } from 'vitest';
import { installState, isIosDevice, isStandalonePwa } from './pwaInstall.js';

describe('DING PWA install state', () => {
  it('detects standalone display mode', () => {
    expect(isStandalonePwa({ matchMedia: () => ({ matches: true }) }, {})).toBe(true);
  });

  it('detects modern iPad masquerading as Mac', () => {
    expect(isIosDevice({ userAgent: 'Mozilla/5.0', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
  });

  it('prefers the native install prompt when available', () => {
    expect(
      installState({
        hasNativePrompt: true,
        win: { matchMedia: () => ({ matches: false }) },
        nav: { userAgent: 'Chrome', platform: 'Win32', maxTouchPoints: 0 },
      }).kind
    ).toBe('prompt');
  });

  it('explains iOS manual install only when not already standalone', () => {
    expect(
      installState({
        hasNativePrompt: false,
        win: { matchMedia: () => ({ matches: false }) },
        nav: { userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 5 },
      }).kind
    ).toBe('ios-manual');
  });
});
