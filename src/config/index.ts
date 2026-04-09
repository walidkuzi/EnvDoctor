import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Config, EnumTypeConfig, TypeConfigValue, ValueType } from "../types.js";

const SIMPLE_TYPES: ValueType[] = ["string", "number", "boolean", "url", "port", "email"];
const VALID_FRAMEWORKS = ["auto", "nextjs", "vite", "none"];

export function loadConfig(cwd: string, configPath?: string): Config | null {
  const resolved = configPath
    ? resolve(cwd, configPath)
    : resolve(cwd, "env-doctor.json");

  if (!existsSync(resolved)) {
    return null;
  }

  let raw: string;
  try {
    raw = readFileSync(resolved, "utf-8");
  } catch {
    throw new Error(`Could not read config file: ${resolved}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `Config file is not valid JSON: ${resolved}\nMake sure env-doctor.json contains valid JSON.`,
    );
  }

  return validateConfig(parsed);
}

function validateConfig(raw: unknown): Config {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(
      `Config must be a JSON object. Got ${Array.isArray(raw) ? "array" : typeof raw}.`,
    );
  }

  const obj = raw as Record<string, unknown>;
  const config: Config = {};

  if (obj.types !== undefined) {
    if (typeof obj.types !== "object" || obj.types === null || Array.isArray(obj.types)) {
      throw new Error(`"types" in config must be an object like { "PORT": "number" }.`);
    }
    const types: Record<string, TypeConfigValue> = {};
    for (const [key, val] of Object.entries(obj.types as Record<string, unknown>)) {
      types[key] = validateTypeValue(key, val);
    }
    config.types = types;
  }

  if (obj.required !== undefined) {
    if (!Array.isArray(obj.required) || !obj.required.every((v) => typeof v === "string")) {
      throw new Error(`"required" in config must be an array of strings.`);
    }
    config.required = obj.required as string[];
  }

  if (obj.dangerousValues !== undefined) {
    if (
      !Array.isArray(obj.dangerousValues) ||
      !obj.dangerousValues.every((v) => typeof v === "string")
    ) {
      throw new Error(`"dangerousValues" in config must be an array of strings.`);
    }
    config.dangerousValues = obj.dangerousValues as string[];
  }

  if (obj.framework !== undefined) {
    if (typeof obj.framework !== "string" || !VALID_FRAMEWORKS.includes(obj.framework)) {
      throw new Error(
        `"framework" in config must be one of: ${VALID_FRAMEWORKS.join(", ")}. Got "${String(obj.framework)}".`,
      );
    }
    config.framework = obj.framework as Config["framework"];
  }

  if (obj.files !== undefined) {
    if (!Array.isArray(obj.files) || !obj.files.every((v) => typeof v === "string")) {
      throw new Error(`"files" in config must be an array of file paths (strings).`);
    }
    config.files = obj.files as string[];
  }

  return config;
}

/**
 * Validate a single type config value.
 * Supports both simple string types ("number") and enum objects ({ type: "enum", values: [...] }).
 * Also supports configs where enum types were not available — any ValueType string is still valid.
 */
function validateTypeValue(key: string, val: unknown): TypeConfigValue {
  // Simple string type
  if (typeof val === "string") {
    if (!SIMPLE_TYPES.includes(val as ValueType)) {
      throw new Error(
        `Invalid type "${val}" for "${key}" in config. Valid types: ${SIMPLE_TYPES.join(", ")}, or { "type": "enum", "values": [...] }.`,
      );
    }
    return val as ValueType;
  }

  // Enum object type
  if (typeof val === "object" && val !== null && !Array.isArray(val)) {
    const obj = val as Record<string, unknown>;
    if (obj.type !== "enum") {
      throw new Error(
        `Object type for "${key}" must have "type": "enum". Got "${String(obj.type)}".`,
      );
    }
    if (!Array.isArray(obj.values) || obj.values.length === 0 || !obj.values.every((v) => typeof v === "string")) {
      throw new Error(
        `Enum type for "${key}" must have a "values" array of strings.`,
      );
    }
    return { type: "enum", values: obj.values } as EnumTypeConfig;
  }

  throw new Error(
    `Invalid type config for "${key}". Expected a type string or { "type": "enum", "values": [...] }.`,
  );
}
