export const META_SCHEMA_VERSION = 1;

export function createDefaultMetaState(overrides = {}) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new TypeError('MetaState overrides must be an object');
  }
  return {
    metaSchemaVersion: META_SCHEMA_VERSION,
    ...overrides,
  };
}
