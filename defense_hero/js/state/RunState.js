export const RUN_SCHEMA_VERSION = 1;

export function createRunState(overrides = {}) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new TypeError('RunState overrides must be an object');
  }
  return {
    runSchemaVersion: RUN_SCHEMA_VERSION,
    ...overrides,
  };
}
