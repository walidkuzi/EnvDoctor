import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Config, ValueType } from "../types.js";

const VALID_TYPES: ValueType[] = ["string", "number", "boolean", "url"];

export function loadConfig(cwd: string): Config | null {
  const configPath = resolve(cwd, "env-doctor.json");

  if (!existsSync(configPath)) {
    return null;
  }

  let raw: string;
  try {
    raw = readFileSync(configPath, "utf-8");
  } catch {
    throw new Error(`Could not read config file: ${configPath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `Config file is not valid JSON: ${configPath}\nMake sure env-doctor.json contains valid JSON.`,
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
    const types: Record<string, ValueType> = {};
    for (const [key, val] of Object.entries(obj.types as Record<string, unknown>)) {
      if (typeof val !== "string" || !VALID_TYPES.includes(val as ValueType)) {
        throw new Error(
          `Invalid type "${String(val)}" for "${key}" in config. Valid types: ${VALID_TYPES.join(", ")}.`,
        );
      }
      types[key] = val as ValueType;
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

  return config;
}
