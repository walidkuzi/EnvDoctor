import type {
  Config,
  EnvEntry,
  ExplainResult,
  Issue,
  ResolvedType,
  ValueType,
} from "../types.js";
import { inferVariable, getKnownEnumValues } from "../inference/index.js";
import { validateType } from "../validators/index.js";
import { checkDangerousValue } from "./dangerous.js";

interface ExplainInput {
  key: string;
  envEntries: EnvEntry[];
  exampleEntries: EnvEntry[];
  config: Config | null;
}

/**
 * Find the closest key match using simple edit distance / substring matching.
 */
function findClosestMatch(key: string, candidates: string[]): string | undefined {
  const upper = key.toUpperCase();

  // First try substring match
  const substringMatch = candidates.find(
    (c) => c.toUpperCase().includes(upper) || upper.includes(c.toUpperCase()),
  );
  if (substringMatch) return substringMatch;

  // Then try simple character overlap (Jaccard-like)
  let best: string | undefined;
  let bestScore = 0;

  for (const candidate of candidates) {
    const cUpper = candidate.toUpperCase();
    const setA = new Set(upper.split(""));
    const setB = new Set(cUpper.split(""));
    const intersection = [...setA].filter((c) => setB.has(c)).length;
    const union = new Set([...setA, ...setB]).size;
    const score = intersection / union;

    if (score > bestScore && score > 0.5) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

export function explain(input: ExplainInput): ExplainResult {
  const { key, envEntries, exampleEntries, config } = input;

  const envEntry = envEntries.find((e) => e.key === key);
  const exampleEntry = exampleEntries.find((e) => e.key === key);

  const existsInEnv = !!envEntry;
  const existsInExample = !!exampleEntry;
  const envValue = envEntry?.value;
  const exampleValue = exampleEntry?.value;
  const isEmpty = existsInEnv && (envValue === "" || envValue?.trim() === "");

  // Determine if required
  const isRequired =
    existsInExample || (config?.required?.includes(key) ?? false);

  // Resolve expected type
  let expectedType: ResolvedType | undefined;
  const configType = config?.types?.[key];
  if (configType) {
    if (typeof configType === "object" && configType.type === "enum") {
      expectedType = { type: "enum", source: "config", enumValues: configType.values };
    } else {
      expectedType = { type: configType as ValueType, source: "config" };
    }
  } else {
    const inferred = inferVariable(key, envValue, exampleValue);
    if (inferred.type !== "string") {
      expectedType = {
        type: inferred.type,
        source: "inferred",
        enumValues: inferred.enumValues,
      };
    }
  }

  // Collect specific issues for this variable
  const issues: Issue[] = [];

  if (!existsInEnv && isRequired) {
    issues.push({
      kind: "missing",
      severity: "error",
      key,
      message: `${key} is required but missing from your .env file.`,
      hint: "Add it to your .env file.",
      example: exampleValue ? `${key}=${exampleValue}` : undefined,
    });
  }

  if (isEmpty) {
    issues.push({
      kind: "empty",
      severity: "warning",
      key,
      message: `${key} is present but has no value.`,
      hint: "Set a value for this variable.",
    });
  }

  if (existsInEnv && envValue && !isEmpty && expectedType) {
    if (expectedType.type === "enum") {
      const allowed = expectedType.enumValues ?? getKnownEnumValues(key) ?? [];
      if (allowed.length > 0 && !allowed.includes(envValue)) {
        issues.push({
          kind: "invalid_enum",
          severity: "warning",
          key,
          message: `${key} should be one of: ${allowed.join(", ")}. Found "${envValue}".`,
        });
      }
    } else if (!validateType(envValue, expectedType.type)) {
      issues.push({
        kind: "invalid_type",
        severity: "warning",
        key,
        message: `${key} should be a ${expectedType.type}, but found "${envValue}".`,
      });
    }
  }

  if (existsInEnv && envValue && !isEmpty) {
    const dangerCheck = checkDangerousValue(key, envValue, config?.dangerousValues);
    if (dangerCheck.isDangerous) {
      issues.push({
        kind: dangerCheck.kind,
        severity: "warning",
        key,
        message: dangerCheck.reason ?? `${key} looks dangerous.`,
      });
    }
  }

  // Generate suggestion
  let suggestion: string | undefined;
  if (!existsInEnv && exampleValue) {
    suggestion = `Add to your .env file: ${key}=${exampleValue}`;
  } else if (isEmpty && exampleValue) {
    suggestion = `Set a value like: ${key}=${exampleValue}`;
  }

  // Find closest match if variable doesn't exist anywhere
  let closestMatch: string | undefined;
  if (!existsInEnv && !existsInExample) {
    const allKeys = [
      ...exampleEntries.map((e) => e.key),
      ...envEntries.map((e) => e.key),
    ];
    closestMatch = findClosestMatch(key, allKeys);
  }

  return {
    key,
    existsInExample,
    existsInEnv,
    exampleValue,
    envValue,
    isEmpty,
    isRequired,
    expectedType,
    issues,
    suggestion,
    closestMatch,
  };
}
