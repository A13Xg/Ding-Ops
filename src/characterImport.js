// Provider boundary stays intentionally independent from Supabase persistence.
import { normalizeCharacterDraft, validateCharacterDraft } from './dingDomain.js';
import { GAME_CONFIG } from './gameConfig.js';

export const CHARACTER_PROVIDER_IDS = Object.freeze({
  MANUAL: 'manual',
  BATTLE_NET: 'battle.net',
});

/**
 * Provider-neutral character DTO used before anything is written to DING.
 * Importers may supply extra metadata, but progression fields remain subject
 * to the same validation as manual character creation.
 */
export function normalizeCharacterImport(input = {}, config = GAME_CONFIG) {
  const source = String(input.source || CHARACTER_PROVIDER_IDS.MANUAL);
  const externalId = input.externalId == null ? null : String(input.externalId).trim().slice(0, 160) || null;
  const draft = normalizeCharacterDraft(
    {
      name: input.name,
      realm: input.realm,
      region: input.region,
      class_name: input.class_name ?? input.className,
      spec: input.spec,
      race: input.race,
      faction: input.faction,
      current_level: input.current_level ?? input.currentLevel,
      tracked_from_level: input.tracked_from_level ?? input.trackedFromLevel ?? input.current_level ?? input.currentLevel,
    },
    config
  );

  return {
    source,
    externalId,
    character: draft,
    observedAt: input.observedAt ? new Date(input.observedAt).toISOString() : null,
  };
}

export function validateCharacterImport(input = {}, config = GAME_CONFIG) {
  const normalized = normalizeCharacterImport(input, config);
  const result = validateCharacterDraft(normalized.character, config);
  const errors = { ...result.errors };

  if (![CHARACTER_PROVIDER_IDS.MANUAL, CHARACTER_PROVIDER_IDS.BATTLE_NET].includes(normalized.source)) {
    errors.source = 'Unknown character import provider.';
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { ...normalized, character: result.value },
  };
}

export function manualCharacterImport(draft, config = GAME_CONFIG) {
  return validateCharacterImport({ ...draft, source: CHARACTER_PROVIDER_IDS.MANUAL }, config);
}

/**
 * Thin adapter registry. DING owns the DTO; providers only translate external
 * records into it. No provider is allowed to write levels directly.
 */
export function createCharacterImportRegistry(providers = {}) {
  const registry = new Map(Object.entries(providers));

  return {
    has(providerId) {
      return registry.has(providerId);
    },
    async import(providerId, request, config = GAME_CONFIG) {
      const provider = registry.get(providerId);
      if (!provider?.fetchCharacter) throw new Error(`Character provider "${providerId}" is not configured.`);
      const raw = await provider.fetchCharacter(request);
      const validated = validateCharacterImport({ ...raw, source: providerId }, config);
      if (!validated.ok) {
        throw new Error(Object.values(validated.errors)[0] || 'Imported character is invalid.');
      }
      return validated.value;
    },
  };
}

/**
 * Intentional v1 boundary: Battle.net OAuth is not required for DING to work.
 * A future provider must implement fetchCharacter() and can then be registered
 * without touching the database write path or manual character flow.
 */
export function battleNetProviderStub() {
  return {
    id: CHARACTER_PROVIDER_IDS.BATTLE_NET,
    configured: false,
    async fetchCharacter() {
      throw new Error('Battle.net import is not configured. Manual characters remain fully supported.');
    },
  };
}
