import type {
  AnalysisResult,
  Config,
  EnvEntry,
  Issue,
  ParseResult,
  Summary,
  ValueType,
} from "../types.js";
import { inferType, typeExample, validateType } from "../validators/index.js";
import { checkDangerousValue } from "./dangerous.js";

interface AnalyzeInput {
  env: ParseResult;
  example: ParseResult;
  config: Config | null;
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

  // --- Empty, invalid type, and dangerous values (for keys present in both) ---
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
      // Skip further checks for empty values
      continue;
    }

    // Determine expected type
    const configType = config?.types?.[key];
    const exampleEntry = exampleMap.get(key);
    const inferredType: ValueType | null = exampleEntry?.value
      ? inferType(exampleEntry.value)
      : null;
    const expectedType = configType ?? inferredType;

    // Type validation (skip pure "string" — anything non-empty is valid)
    if (expectedType && expectedType !== "string") {
      if (!validateType(value, expectedType)) {
        issues.push({
          kind: "invalid_type",
          severity: "warning",
          key,
          message: `${key} should be a ${expectedType}, but found "${value}".`,
          hint: `Set a valid ${expectedType} value.`,
          example: `${key}=${typeExample(expectedType)}`,
        });
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
        kind: "dangerous_value",
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
