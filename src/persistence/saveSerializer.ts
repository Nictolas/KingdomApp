import { normalizeGameSave, SaveValidationError, validateSaveEnvelope } from "./saveValidation.ts";
import type { SaveEnvelopeV1 } from "./saveTypes.ts";

const INFINITY_MARKER_KEY = "__mykingdom_number_v1__";
const INFINITY_MARKER_VALUE = "Infinity";

export function serializeSave(envelope: SaveEnvelopeV1): string {
  validateSaveEnvelope(envelope);
  return JSON.stringify(envelope, (_key, value: unknown) =>
    value === Infinity ? { [INFINITY_MARKER_KEY]: INFINITY_MARKER_VALUE } : value
  );
}

export function deserializeSave(serialized: string): SaveEnvelopeV1 {
  let value: unknown;
  try {
    value = JSON.parse(serialized, (_key, current: unknown) => {
      if (
        typeof current === "object" &&
        current !== null &&
        !Array.isArray(current) &&
        Object.keys(current).length === 1 &&
        (current as Record<string, unknown>)[INFINITY_MARKER_KEY] === INFINITY_MARKER_VALUE
      ) {
        return Infinity;
      }
      return current;
    });
  } catch {
    throw new SaveValidationError("JSON del salvataggio non valido.");
  }
  validateSaveEnvelope(value);
  return { ...value, payload: normalizeGameSave(value.payload) };
}
