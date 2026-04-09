import type { Config, EnvEntry, TypeConfigValue } from "../types.js";
import { inferVariable } from "../inference/index.js";

const SECRET_NAME_PATTERNS = [
  "SECRET", "TOKEN", "KEY", "PASSWORD", "PASS", "JWT",
  "PRIVATE", "AUTH", "CREDENTIAL",
];

function looksLikeSecretName(key: string): boolean {
  const upper = key.toUpperCase();
  return SECRET_NAME_PATTERNS.some((p) => upper.includes(p));
}

export interface InitResult {
  config: Config;
  stats: {
    total: number;
    typed: number;
    required: number;
    enums: number;
  };
}

/**
 * Generate an env-doctor.json config by inferring types from .env.example entries.
 */
export function generateConfig(exampleEntries: EnvEntry[]): InitResult {
  const types: Record<string, TypeConfigValue> = {};
  const required: string[] = [];
  let enums = 0;

  for (const entry of exampleEntries) {
    const inferred = inferVariable(entry.key, undefined, entry.value);

    // Only add non-string types to config (string is the default)
    if (inferred.type !== "string") {
      if (inferred.type === "enum" && inferred.enumValues) {
        types[entry.key] = { type: "enum", values: inferred.enumValues };
        enums++;
      } else {
        types[entry.key] = inferred.type;
      }
    }

    // Secret-like variables are likely required
    if (looksLikeSecretName(entry.key)) {
      required.push(entry.key);
    }
  }

  const config: Config = {};

  if (Object.keys(types).length > 0) {
    config.types = types;
  }

  if (required.length > 0) {
    config.required = required;
  }

  config.dangerousValues = ["changeme", "password", "your_key_here", "replace_me"];

  return {
    config,
    stats: {
      total: exampleEntries.length,
      typed: Object.keys(types).length,
      required: required.length,
      enums,
    },
  };
}
