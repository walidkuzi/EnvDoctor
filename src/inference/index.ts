import type { InferredMeta, ValueType } from "../types.js";
import { validateBoolean, validateNumber, validateUrl, validatePort, validateEmail } from "../validators/index.js";

// Well-known enum variables and their likely values
const KNOWN_ENUMS: Record<string, string[]> = {
  NODE_ENV: ["development", "test", "production", "staging"],
  LOG_LEVEL: ["debug", "info", "warn", "error", "fatal", "trace"],
  ENVIRONMENT: ["development", "test", "production", "staging"],
  APP_ENV: ["development", "test", "production", "staging"],
  RAILS_ENV: ["development", "test", "production"],
};

const ENV_LIKE_VALUES = new Set([
  "development", "test", "testing", "production", "staging", "local", "preview",
]);

// Name patterns that strongly suggest a type
const PORT_NAME_PATTERNS = ["_PORT", "PORT"];
const URL_NAME_PATTERNS = ["_URL", "_URI", "_ENDPOINT", "_HOST", "_ORIGIN", "_HREF"];
const EMAIL_NAME_PATTERNS = ["_EMAIL", "_MAIL", "EMAIL_FROM", "EMAIL_TO", "SMTP_FROM"];
const BOOLEAN_NAME_PATTERNS = [
  "ENABLE_", "DISABLE_", "IS_", "HAS_", "USE_", "WITH_", "ALLOW_", "FORCE_",
  "_ENABLED", "_DISABLED", "_VERBOSE", "_DEBUG",
];

function nameEndsWith(key: string, patterns: string[]): boolean {
  const upper = key.toUpperCase();
  return patterns.some((p) => upper.endsWith(p));
}

function nameStartsWith(key: string, patterns: string[]): boolean {
  const upper = key.toUpperCase();
  return patterns.some((p) => upper.startsWith(p));
}

function nameMatches(key: string, patterns: string[]): boolean {
  return nameEndsWith(key, patterns) || nameStartsWith(key, patterns);
}

/**
 * Infer the type of a variable from its value alone.
 */
export function inferTypeFromValue(value: string): { type: ValueType; confidence: "high" | "medium" } {
  if (value === "") return { type: "string", confidence: "medium" };

  // Boolean check first (before number, since "1"/"0" are valid for both)
  if (["true", "false", "yes", "no"].includes(value.toLowerCase())) {
    return { type: "boolean", confidence: "high" };
  }

  // Port-like numbers
  if (validatePort(value) && Number(value) >= 80) {
    // Could be a port, but also could be a plain number.
    // We'll let name-based inference decide between port and number.
    return { type: "number", confidence: "medium" };
  }

  if (validateNumber(value)) {
    return { type: "number", confidence: "medium" };
  }

  if (validateUrl(value)) {
    return { type: "url", confidence: "high" };
  }

  if (validateEmail(value)) {
    return { type: "email", confidence: "medium" };
  }

  return { type: "string", confidence: "medium" };
}

/**
 * Infer the type of a variable from its name.
 */
export function inferTypeFromName(key: string): { type: ValueType; confidence: "high" | "medium" | "low" } | null {
  const upper = key.toUpperCase();

  // Exact matches in known enums
  if (KNOWN_ENUMS[upper]) {
    return { type: "enum", confidence: "high" };
  }

  if (nameEndsWith(key, PORT_NAME_PATTERNS) || upper === "PORT") {
    return { type: "port", confidence: "high" };
  }

  if (nameMatches(key, URL_NAME_PATTERNS)) {
    return { type: "url", confidence: "medium" };
  }

  if (nameMatches(key, EMAIL_NAME_PATTERNS)) {
    return { type: "email", confidence: "low" };
  }

  if (nameMatches(key, BOOLEAN_NAME_PATTERNS) || upper === "DEBUG" || upper === "VERBOSE") {
    return { type: "boolean", confidence: "medium" };
  }

  return null;
}

/**
 * Full inference combining name + value + example value.
 * Returns the best guess for a variable's type metadata.
 */
export function inferVariable(
  key: string,
  envValue?: string,
  exampleValue?: string,
): InferredMeta {
  const upper = key.toUpperCase();

  // Check known enums first
  if (KNOWN_ENUMS[upper]) {
    return {
      key,
      type: "enum",
      enumValues: KNOWN_ENUMS[upper],
      source: "name",
      confidence: "high",
    };
  }

  // Check if the example value looks like an env-like enum value
  const valueToCheck = exampleValue ?? envValue ?? "";
  if (ENV_LIKE_VALUES.has(valueToCheck.toLowerCase())) {
    return {
      key,
      type: "enum",
      enumValues: [...ENV_LIKE_VALUES],
      source: "value",
      confidence: "medium",
    };
  }

  // Name-based inference
  const nameInference = inferTypeFromName(key);

  // Value-based inference (prefer example value)
  const valueSource = exampleValue ?? envValue ?? "";
  const valueInference = valueSource ? inferTypeFromValue(valueSource) : null;

  // Combine: name-based wins for port/url/email/boolean if confident
  if (nameInference) {
    // Port names should produce port type even if value happens to be a plain number
    if (nameInference.type === "port") {
      return {
        key,
        type: "port",
        source: "name",
        confidence: nameInference.confidence,
      };
    }
    // URL names produce url type
    if (nameInference.type === "url") {
      return {
        key,
        type: "url",
        source: "name",
        confidence: nameInference.confidence,
      };
    }
    // Boolean names produce boolean type
    if (nameInference.type === "boolean" && (!valueInference || valueInference.type !== "url")) {
      return {
        key,
        type: "boolean",
        source: "name",
        confidence: nameInference.confidence,
      };
    }
    // Email names produce email type
    if (nameInference.type === "email") {
      return {
        key,
        type: "email",
        source: "name",
        confidence: nameInference.confidence,
      };
    }
  }

  // Fall back to value-based inference
  if (valueInference && valueInference.type !== "string") {
    return {
      key,
      type: valueInference.type,
      source: "value",
      confidence: valueInference.confidence,
    };
  }

  return {
    key,
    type: "string",
    source: "value",
    confidence: "low",
  };
}

/**
 * Get the known enum values for a key, if applicable.
 */
export function getKnownEnumValues(key: string): string[] | undefined {
  return KNOWN_ENUMS[key.toUpperCase()];
}
