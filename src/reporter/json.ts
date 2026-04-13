import type {
  AnalysisResult,
  ExplainResult,
  MultiEnvResult,
} from "../types.js";
import type { DiffResult } from "../core/diff.js";
import {
  SCHEMA_VERSION,
  TOOL_VERSION,
  buildJsonEnvelope,
  toSchemaIssue,
} from "../output/index.js";

/**
 * Render a JSON envelope for an analysis-backed command (check / ci / validate).
 *
 * The shape is the new v1.0.0 envelope (schemaVersion, toolVersion, project, ...)
 * but we also keep the legacy top-level keys (`version`, `issues`, `summary`)
 * for backward compatibility with scripts that parsed the v0.2 shape.
 */
export function renderJSONAnalysis(
  result: AnalysisResult,
  command: string,
  extra: { root?: string; exitCode?: number } = {},
): string {
  const envelope = buildJsonEnvelope({
    command,
    root: extra.root ?? process.cwd(),
    issues: result.issues.map(toSchemaIssue),
    exitCode: extra.exitCode ?? (result.summary.errors > 0 ? 1 : 0),
  });

  // Backward-compatible legacy fields. We keep `version` and the legacy
  // `summary` shape (which includes `total`/`valid`) at the top level.
  // The `issues` array is the rich schema form — a strict superset of the
  // v0.2 shape, so consumers that only read legacy fields still work.
  const legacy = {
    version: TOOL_VERSION,
    summary: result.summary,
  };

  return JSON.stringify({ ...envelope, ...legacy }, null, 2);
}

export function renderJSONDiff(
  diff: DiffResult,
  extra: { root?: string; exitCode?: number } = {},
): string {
  const envelope = buildJsonEnvelope({
    command: "diff",
    root: extra.root ?? process.cwd(),
    exitCode: extra.exitCode ?? (diff.onlyInExample.length > 0 ? 1 : 0),
    data: {
      onlyInExample: diff.onlyInExample,
      onlyInEnv: diff.onlyInEnv,
      inBoth: diff.inBoth,
    },
  });

  // Override `ok` for diff: semantically "ok" means no missing keys
  envelope.ok = diff.onlyInExample.length === 0;

  const legacy = {
    version: TOOL_VERSION,
    onlyInExample: diff.onlyInExample,
    onlyInEnv: diff.onlyInEnv,
    inBoth: diff.inBoth,
  };

  return JSON.stringify({ ...envelope, ...legacy }, null, 2);
}

export function renderJSONExplain(
  result: ExplainResult,
  extra: { root?: string; exitCode?: number } = {},
): string {
  const envelope = buildJsonEnvelope({
    command: "explain",
    root: extra.root ?? process.cwd(),
    issues: result.issues.map(toSchemaIssue),
    exitCode: extra.exitCode ?? (result.issues.length > 0 ? 1 : 0),
    data: {
      key: result.key,
      existsInExample: result.existsInExample,
      existsInEnv: result.existsInEnv,
      exampleValue: result.exampleValue,
      envValue: result.envValue,
      isEmpty: result.isEmpty,
      isRequired: result.isRequired,
      expectedType: result.expectedType,
      suggestion: result.suggestion,
      closestMatch: result.closestMatch,
    },
  });

  // Backward-compat: keep top-level explain fields (key, existsInEnv, etc.)
  // for v0.2 consumers, but don't overwrite the schema `issues` array.
  const { issues: _issues, ...resultWithoutIssues } = result;
  const legacy = {
    version: TOOL_VERSION,
    ...resultWithoutIssues,
  };

  return JSON.stringify({ ...envelope, ...legacy }, null, 2);
}

export function renderJSONMatrix(
  result: MultiEnvResult,
  extra: { root?: string; exitCode?: number } = {},
): string {
  const envelope = buildJsonEnvelope({
    command: "matrix",
    root: extra.root ?? process.cwd(),
    exitCode: extra.exitCode ?? 0,
    data: {
      files: result.files,
      keys: result.keys,
      matrix: result.matrix,
    },
  });

  const legacy = {
    version: TOOL_VERSION,
    files: result.files,
    keys: result.keys,
    matrix: result.matrix,
  };

  return JSON.stringify({ ...envelope, ...legacy }, null, 2);
}

// Re-export schema version for external consumers
export { SCHEMA_VERSION };
