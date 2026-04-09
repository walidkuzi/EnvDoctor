import type {
  AnalysisResult,
  Config,
  EnvEntry,
  EnumTypeConfig,
  Issue,
  ParseResult,
  Summary,
  ValueType,
} from "../types.js";
import { validateType, typeExample } from "../validators/index.js";
import { inferVariable, getKnownEnumValues } from "../inference/index.js";
import { checkDangerousValue } from "./dangerous.js";

interface AnalyzeInput {
  env: ParseResult;
  example: ParseResult;
  config: Config | null;
}

/**
 * Resolve the expected type and enum values for a variable.
 * Priority: config > inference.
 */
function resolveType(
  key: string,
  config: Config | null,
  exampleValue?: string,
  envValue?: string,
): { type: ValueType; enumValues?: string[]; source: "config" | "inferred" } | null {
  // Check config first
  const configType = config?.types?.[key];
  if (configType) {
    if (typeof configType === "object" && configType.type === "enum") {
      return { type: "enum", enumValues: configType.values, source: "config" };
    }
    return { type: configType as ValueType, source: "config" };
  }

  // Fall back to inference
  const inferred = inferVariable(key, envValue, exampleValue);
  if (inferred.type === "string") return null; // Don't validate plain strings
  return {
    type: inferred.type,
    enumValues: inferred.enumValues,
    source: "inferred",
  };
}

export function analyze({ env, example, config }: AnalyzeInput): AnalysisResult {
  const issues: Issue[] = [];

  const envMap = new Map<string, EnvEntry>();
  for (const entry of env.entries) {
    envMap.set(entry.key, entry);
  }

  const exampleMap = new Map<string, EnvEntry>();
  for (const entry of example.entries) {
    exampleMap.set(entry.key, entry);
  }

  const expectedKeys = new Set(exampleMap.keys());
  const actualKeys = new Set(envMap.keys());

  // Add config-required keys to expected set
  if (config?.required) {
    for (const key of config.required) {
      expectedKeys.add(key);
    }
  }

  // --- Missing variables ---
  for (const key of expectedKeys) {
    if (!actualKeys.has(key)) {
      const exampleEntry = exampleMap.get(key);
      const exampleValue = exampleEntry?.value;
      issues.push({
        kind: "missing",
        severity: "error",
        key,
        message: `${key} is missing from your .env file.`,
        hint: "Add it to your .env file.",
        example: exampleValue ? `${key}=${exampleValue}` : undefined,
      });
    }
  }

  // --- Extra variables ---
  for (const key of actualKeys) {
    if (!exampleMap.has(key)) {
      issues.push({
        kind: "extra",
        severity: "info",
        key,
        message: `${key} exists in .env but not in .env.example.`,
        hint: "This may be intentional, or it could be a leftover variable.",
      });
    }
  }

  // --- Empty, invalid type, and dangerous values (for keys present in .env) ---
  for (const key of actualKeys) {
    const entry = envMap.get(key)!;
    const value = entry.value;

    // Empty check
    if (value === "" || value.trim() === "") {
      issues.push({
        kind: "empty",
        severity: "warning",
        key,
        message: `${key} is present but empty.`,
        hint: "Set a value for this variable in your .env file.",
        example: exampleMap.has(key)
          ? `${key}=${exampleMap.get(key)!.value}`
          : undefined,
      });
      continue;
    }

    // Resolve expected type
    const exampleEntry = exampleMap.get(key);
    const resolved = resolveType(key, config, exampleEntry?.value, value);

    if (resolved) {
      if (resolved.type === "enum") {
        const allowed = resolved.enumValues ?? getKnownEnumValues(key) ?? [];
        if (allowed.length > 0 && !allowed.includes(value)) {
          issues.push({
            kind: "invalid_enum",
            severity: "warning",
            key,
            message: `${key} should be one of: ${allowed.join(", ")}. Found "${value}".`,
            hint: `Set ${key} to one of the allowed values.`,
            example: `${key}=${allowed[0]}`,
          });
        }
      } else if (resolved.type !== "string") {
        if (!validateType(value, resolved.type)) {
          issues.push({
            kind: "invalid_type",
            severity: "warning",
            key,
            message: `${key} should be a ${resolved.type}, but found "${value}".`,
            hint: `Set a valid ${resolved.type} value.`,
            example: `${key}=${typeExample(resolved.type)}`,
          });
        }
      }
    }

    // Dangerous value check
    const dangerCheck = checkDangerousValue(
      key,
      value,
      config?.dangerousValues,
    );
    if (dangerCheck.isDangerous) {
      issues.push({
        kind: dangerCheck.kind,
        severity: "warning",
        key,
        message: `${key} looks weak: "${value}".`,
        hint: dangerCheck.reason ?? "Use a stronger value.",
      });
    }
  }

  // --- Parse warnings from .env ---
  for (const warning of env.warnings) {
    issues.push({
      kind: "parse_warning",
      severity: "warning",
      key: `line ${warning.line}`,
      message: warning.message,
      hint: `Check line ${warning.line}: ${warning.raw}`,
    });
  }

  const summary = computeSummary(issues, actualKeys.size);

  return { issues, summary };
}

function computeSummary(issues: Issue[], totalKeys: number): Summary {
  let errors = 0;
  let warnings = 0;
  let infos = 0;

  for (const issue of issues) {
    switch (issue.severity) {
      case "error":
        errors++;
        break;
      case "warning":
        warnings++;
        break;
      case "info":
        infos++;
        break;
    }
  }

  return {
    errors,
    warnings,
    infos,
    total: totalKeys,
    valid: totalKeys - issues.filter((i) => i.severity === "error" && i.kind !== "missing").length,
  };
}
