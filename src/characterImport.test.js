import { describe, expect, it, vi } from 'vitest';
import {
  CHARACTER_PROVIDER_IDS,
  battleNetProviderStub,
  createCharacterImportRegistry,
  manualCharacterImport,
  validateCharacterImport,
} from './characterImport.js';

describe('character import boundary', () => {
  const base = {
    name: 'Testmage',
    realm: 'Area 52',
    region: 'US',
    className: 'Mage',
    currentLevel: 81,
    faction: 'Horde',
  };

  it('uses the same domain validation as manual character creation', () => {
    const result = manualCharacterImport(base);
    expect(result.ok).toBe(true);
    expect(result.value.character).toMatchObject({
      name: 'Testmage',
      realm: 'Area 52',
      class_name: 'Mage',
      current_level: 81,
      tracked_from_level: 81,
    });
  });

  it('rejects provider data that would violate DING character rules', () => {
    const result = validateCharacterImport({ ...base, source: CHARACTER_PROVIDER_IDS.BATTLE_NET, currentLevel: 999 });
    expect(result.ok).toBe(false);
    expect(result.errors.current_level).toBeTruthy();
  });

  it('keeps provider fetch separate from persistence', async () => {
    const fetchCharacter = vi.fn(async () => ({
      ...base,
      externalId: 'character-123',
    }));
    const registry = createCharacterImportRegistry({
      [CHARACTER_PROVIDER_IDS.BATTLE_NET]: { fetchCharacter },
    });
    const result = await registry.import(CHARACTER_PROVIDER_IDS.BATTLE_NET, { name: 'ignored' });
    expect(fetchCharacter).toHaveBeenCalledOnce();
    expect(result.externalId).toBe('character-123');
    expect(result.character.name).toBe('Testmage');
  });

  it('ships Battle.net as an explicit optional stub, not a core dependency', async () => {
    const provider = battleNetProviderStub();
    expect(provider.configured).toBe(false);
    await expect(provider.fetchCharacter()).rejects.toThrow(/not configured/i);
  });
});
