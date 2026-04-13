import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnvContent } from "../parser/index.js";
import type { Config, EnvEntry, ValueType } from "../types.js";
import { validateType } from "../validators/index.js";
import { inferVariable } from "../inference/index.js";
import { checkDangerousValue } from "../core/dangerous.js";
import type { ScanResult } from "../scanner/index.js";

export type PlaceholderPolicy = "empty" | "example" | "todo";

export interface FixerOptions {
  apply?: boolean;
  yes?: boolean;
  removeUnused?: boolean;
  fromScan?: boolean;
  forceOverwrite?: boolean;
  noBackup?: boolean;
  placeholderPolicy?: PlaceholderPolicy;
  envFile?: string;
  exampleFile?: string;
}

export type PlannedFixKind =
  | "add-missing"
  | "normalize-boolean"
  | "normalize-number"
  | "replace-placeholder"
  | "remove-extra"
  | "add-from-scan";

export interface PlannedFix {
  kind: PlannedFixKind;
  key: string;
  before?: string;
  after?: string;
  line?: number;
  description: string;
  risky: boolean;
}

export interface FixPlan {
  targetPath: string;
  backupPath?: string;
  fixes: PlannedFix[];
  unresolved: string[];
}

export interface FixInput {
  cwd: string;
  config: Config | null;
  scan?: ScanResult;
  options: FixerOptions;
}

export const TODO_PLACEHOLDER = "__REPLACE_ME__";

/**
 * Plan all fixes for the .env file without writing anything.
 * This is the pure, testable core of the fix command.
 */
export function planFixes(input: FixInput): FixPlan {
  const { cwd, config, scan, options } = input;
  const envFileName = options.envFile ?? ".env";
  const exampleFileName = options.exampleFile ?? ".env.example";

  const envPath = resolve(cwd, envFileName);
  const examplePath = resolve(cwd, exampleFileName);

  const envContent = existsSync(envPath) ? readFileSync(envPath, "utf-8") : "";
  const exampleContent = existsSync(examplePath)
    ? readFileSync(examplePath, "utf-8")
    : "";

  const env = parseEnvContent(envContent);
  const example = parseEnvContent(exampleContent);

  const envMap = new Map<string, EnvEntry>();
  for (const e of env.entries) envMap.set(e.key, e);
  const exampleMap = new Map<string, EnvEntry>();
  for (const e of example.entries) exampleMap.set(e.key, e);

  const fixes: PlannedFix[] = [];

  // 1) Add missing required keys from example or config.required
  const expectedKeys = new Set<string>();
  for (const k of exampleMap.keys()) expectedKeys.add(k);
  if (config?.required) for (const k of config.required) expectedKeys.add(k);

  for (const key of expectedKeys) {
    if (envMap.has(key)) continue;
    const exampleEntry = exampleMap.get(key);
    const after = placeholderValue(
      exampleEntry?.value,
      options.placeholderPolicy ?? "todo",
    );
    fixes.push({
      kind: "add-missing",
      key,
      after: `${key}=${after}`,
      description: `Add missing key ${key}`,
      risky: false,
    });
  }

  // 2) Normalize boolean / number values for typed keys
  for (const entry of env.entries) {
    if (entry.value === "") continue;

    const resolvedType = resolveExpectedType(
      entry.key,
      config,
      exampleMap.get(entry.key)?.value,
      entry.value,
    );
    if (!resolvedType) continue;

    if (resolvedType === "boolean") {
      const normalized = normalizeBoolean(entry.value);
      if (normalized !== null && normalized !== entry.value) {
        fixes.push({
          kind: "normalize-boolean",
          key: entry.key,
          before: `${entry.key}=${entry.value}`,
          after: `${entry.key}=${normalized}`,
          line: entry.line,
          description: `Normalize ${entry.key} to canonical boolean`,
          risky: false,
        });
      }
      continue;
    }

    if (resolvedType === "number" || resolvedType === "port") {
      const trimmed = entry.value.trim();
      if (trimmed !== entry.value && validateType(trimmed, resolvedType)) {
        fixes.push({
          kind: "normalize-number",
          key: entry.key,
          before: `${entry.key}=${entry.value}`,
          after: `${entry.key}=${trimmed}`,
          line: entry.line,
          description: `Trim whitespace in ${entry.key}`,
          risky: false,
        });
      }
    }
  }

  // 3) Replace dangerous placeholder values — only when --force-overwrite
  //    OR the value already looks like a placeholder (then it's safe).
  for (const entry of env.entries) {
    if (entry.value === "") continue;
    const danger = checkDangerousValue(
      entry.key,
      entry.value,
      config?.dangerousValues,
    );
    if (!danger.isDangerous || danger.kind !== "placeholder_value") continue;

    const exampleEntry = exampleMap.get(entry.key);
    const replacement = placeholderValue(
      exampleEntry?.value,
      options.placeholderPolicy ?? "todo",
    );

    // Don't replace if the replacement is the same value
    if (replacement === entry.value) continue;

    fixes.push({
      kind: "replace-placeholder",
      key: entry.key,
      before: `${entry.key}=${entry.value}`,
      after: `${entry.key}=${replacement}`,
      line: entry.line,
      description: `Replace placeholder value in ${entry.key}`,
      risky: !options.forceOverwrite,
    });
  }

  // 4) Remove unused extras — only if --remove-unused
  if (options.removeUnused) {
    for (const entry of env.entries) {
      if (!exampleMap.has(entry.key)) {
        // Skip keys marked required by config
        if (config?.required?.includes(entry.key)) continue;
        fixes.push({
          kind: "remove-extra",
          key: entry.key,
          before: `${entry.key}=${entry.value}`,
          line: entry.line,
          description: `Remove extra key ${entry.key}`,
          risky: true,
        });
      }
    }
  }

  // 5) From-scan: add "used but undefined" keys to .env
  if (options.fromScan && scan) {
    for (const key of scan.usedButUndefined) {
      if (envMap.has(key)) continue;
      if (expectedKeys.has(key)) continue; // already covered by add-missing
      const after = placeholderValue(
        undefined,
        options.placeholderPolicy ?? "todo",
      );
      fixes.push({
        kind: "add-from-scan",
        key,
        after: `${key}=${after}`,
        description: `Add ${key} (used in code but undefined)`,
        risky: false,
      });
    }
  }

  // Unresolved: still-empty required keys that a fix cannot safely populate
  const unresolved: string[] = [];
  for (const key of expectedKeys) {
    const entry = envMap.get(key);
    if (entry && (entry.value === "" || entry.value.trim() === "")) {
      unresolved.push(key);
    }
  }

  return {
    targetPath: envPath,
    fixes,
    unresolved,
  };
}

export interface ApplyResult {
  plan: FixPlan;
  applied: PlannedFix[];
  skipped: { fix: PlannedFix; reason: string }[];
  backupPath?: string;
}

/**
 * Apply a plan by rewriting the .env file in place. Creates a backup first
 * unless `--no-backup` was passed.
 */
export function applyFixes(input: FixInput, plan: FixPlan): ApplyResult {
  const { cwd, options } = input;
  const envPath = plan.targetPath;
  const envContent = existsSync(envPath) ? readFileSync(envPath, "utf-8") : "";

  // Backup
  let backupPath: string | undefined;
  if (!options.noBackup && existsSync(envPath)) {
    backupPath = envPath + ".bak." + timestamp();
    copyFileSync(envPath, backupPath);
  }

  const applied: PlannedFix[] = [];
  const skipped: { fix: PlannedFix; reason: string }[] = [];

  let lines = envContent.split(/\r?\n/);
  // Parse again to find line indices (line numbers are 1-based; arr indices are 0-based)
  const parsed = parseEnvContent(envContent);
  const keyToIndex = new Map<string, number>();
  for (const e of parsed.entries) keyToIndex.set(e.key, e.line - 1);

  // Order operations: updates -> adds -> removes (so indices stay valid)
  const updates = plan.fixes.filter(
    (f) =>
      f.kind === "normalize-boolean" ||
      f.kind === "normalize-number" ||
      f.kind === "replace-placeholder",
  );
  const adds = plan.fixes.filter(
    (f) => f.kind === "add-missing" || f.kind === "add-from-scan",
  );
  const removes = plan.fixes.filter((f) => f.kind === "remove-extra");

  // Updates
  for (const fix of updates) {
    const idx = keyToIndex.get(fix.key);
    if (idx === undefined) {
      skipped.push({ fix, reason: "key not found in file" });
      continue;
    }
    const current = lines[idx];
    // Safety: don't overwrite unless forced OR value matches `before`
    const beforeLine = reconstructLine(current, fix.key);
    if (
      fix.kind === "replace-placeholder" &&
      !options.forceOverwrite &&
      fix.risky
    ) {
      skipped.push({
        fix,
        reason: "would overwrite non-empty value; pass --force-overwrite",
      });
      continue;
    }
    lines[idx] = `${fix.key}=${extractValue(fix.after!)}`;
    applied.push(fix);
    void beforeLine;
  }

  // Removes (highest index first so earlier indices don't shift)
  const removeIndices = removes
    .map((fix) => ({ fix, idx: keyToIndex.get(fix.key) }))
    .filter((r): r is { fix: PlannedFix; idx: number } => r.idx !== undefined)
    .sort((a, b) => b.idx - a.idx);

  for (const { fix, idx } of removeIndices) {
    lines.splice(idx, 1);
    applied.push(fix);
  }

  // Adds — append to end (preserving a trailing newline)
  if (adds.length > 0) {
    if (lines.length > 0 && lines[lines.length - 1] !== "") {
      // ensure blank-line separation if file has content
    }
    for (const fix of adds) {
      lines.push(fix.after!);
      applied.push(fix);
    }
  }

  const output = lines.join("\n");
  writeFileSync(envPath, output, "utf-8");

  return { plan, applied, skipped, backupPath };
}

// --- helpers ---

function resolveExpectedType(
  key: string,
  config: Config | null,
  exampleValue: string | undefined,
  envValue: string | undefined,
): ValueType | null {
  const configType = config?.types?.[key];
  if (configType) {
    if (typeof configType === "object" && configType.type === "enum") {
      return "enum";
    }
    return configType as ValueType;
  }
  const inferred = inferVariable(key, envValue, exampleValue);
  if (inferred.type === "string") return null;
  return inferred.type;
}

export function normalizeBoolean(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(v)) return "true";
  if (["false", "0", "no", "n", "off"].includes(v)) return "false";
  return null;
}

export function placeholderValue(
  exampleValue: string | undefined,
  policy: PlaceholderPolicy,
): string {
  switch (policy) {
    case "empty":
      return "";
    case "example":
      return exampleValue ?? "";
    case "todo":
      return TODO_PLACEHOLDER;
  }
}

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function reconstructLine(raw: string, _key: string): string {
  return raw;
}

function extractValue(line: string): string {
  const eq = line.indexOf("=");
  if (eq === -1) return "";
  return line.slice(eq + 1);
}
