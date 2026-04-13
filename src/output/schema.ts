import type {
  AnalysisResult,
  Issue,
  IssueKind,
  Severity,
  Summary,
} from "../types.js";

/**
 * Stable JSON schema version for env-doctor machine-readable output.
 *
 * Any breaking change to field shapes requires bumping this version.
 * Additive changes (new optional fields) do NOT bump the version.
 */
export const SCHEMA_VERSION = "1.0.0";

/**
 * The current tool version. Kept in sync with package.json.
 */
export const TOOL_VERSION = "0.3.0";

/**
 * Machine-actionable issue codes. These are stable contracts that external
 * tools can rely on. Adding new codes is safe; renaming is not.
 */
export type IssueCode =
  // check / analyze
  | "MISSING"
  | "EXTRA"
  | "EMPTY"
  | "INVALID_TYPE"
  | "INVALID_ENUM"
  | "DANGEROUS_VALUE"
  | "PLACEHOLDER_VALUE"
  | "FRAMEWORK_WARNING"
  | "PARSE_WARNING"
  // scan
  | "USED_BUT_UNDEFINED"
  | "DEFINED_BUT_UNUSED"
  | "POTENTIAL_TYPO"
  // fix
  | "FIX_APPLIED"
  | "FIX_SKIPPED"
  // hooks
  | "HOOK_INSTALLED"
  | "HOOK_ALREADY_PRESENT"
  | "HOOK_UNSUPPORTED_TOOL";

/**
 * Rich issue shape that unifies analyze + scan + fix + hooks.
 * Backward compatible superset of the original Issue type.
 */
export interface SchemaIssue {
  code: IssueCode;
  kind: IssueKind | "unused" | "typo" | "used_but_undefined";
  severity: Severity;
  key: string;
  message: string;
  hint?: string;
  example?: string;
  location?: {
    file: string;
    line?: number;
    column?: number;
  };
  meta?: Record<string, unknown>;
}

/**
 * Planned or applied mutation. Emitted by fix + hooks install.
 */
export interface SchemaAction {
  type:
    | "add"
    | "update"
    | "remove"
    | "backup"
    | "install-hook"
    | "update-package-json";
  target: string;
  description: string;
  applied: boolean;
  before?: string;
  after?: string;
  meta?: Record<string, unknown>;
}

/**
 * Unified envelope returned from --json on every command.
 */
export interface JsonEnvelope {
  schemaVersion: string;
  toolVersion: string;
  command: string;
  ok: boolean;
  timestamp: string;
  project: {
    root: string;
    framework: "auto" | "nextjs" | "vite" | "none" | "unknown";
  };
  issues: SchemaIssue[];
  actions: SchemaAction[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
    totalIssues: number;
  };
  exitCode: number;
  /**
   * Optional, command-specific fields. Kept under `data` to leave the
   * top-level envelope stable across future extensions.
   */
  data?: Record<string, unknown>;
}

const ISSUE_KIND_TO_CODE: Record<IssueKind, IssueCode> = {
  missing: "MISSING",
  extra: "EXTRA",
  empty: "EMPTY",
  invalid_type: "INVALID_TYPE",
  invalid_enum: "INVALID_ENUM",
  dangerous_value: "DANGEROUS_VALUE",
  placeholder_value: "PLACEHOLDER_VALUE",
  framework_warning: "FRAMEWORK_WARNING",
  parse_warning: "PARSE_WARNING",
};

/**
 * Convert a legacy Issue (from analyze/validate) into the schema shape.
 */
export function toSchemaIssue(issue: Issue): SchemaIssue {
  return {
    code: ISSUE_KIND_TO_CODE[issue.kind] ?? "PARSE_WARNING",
    kind: issue.kind,
    severity: issue.severity,
    key: issue.key,
    message: issue.message,
    hint: issue.hint,
    example: issue.example,
  };
}

export interface BuildEnvelopeInput {
  command: string;
  root: string;
  framework?: "auto" | "nextjs" | "vite" | "none" | "unknown";
  issues?: SchemaIssue[];
  actions?: SchemaAction[];
  exitCode: number;
  data?: Record<string, unknown>;
  /**
   * Override for timestamp — useful in tests for deterministic output.
   */
  now?: Date;
}

/**
 * Build the unified JSON envelope. This is the ONLY entry point that
 * should be used to produce --json output across commands.
 */
export function buildJsonEnvelope(input: BuildEnvelopeInput): JsonEnvelope {
  const issues = input.issues ?? [];
  const actions = input.actions ?? [];

  const summary = computeSchemaSummary(issues);
  const ok = summary.errors === 0;

  return {
    schemaVersion: SCHEMA_VERSION,
    toolVersion: TOOL_VERSION,
    command: input.command,
    ok,
    timestamp: (input.now ?? new Date()).toISOString(),
    project: {
      root: input.root,
      framework: input.framework ?? "unknown",
    },
    issues,
    actions,
    summary,
    exitCode: input.exitCode,
    ...(input.data ? { data: input.data } : {}),
  };
}

export function computeSchemaSummary(issues: SchemaIssue[]): {
  errors: number;
  warnings: number;
  infos: number;
  totalIssues: number;
} {
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

  return { errors, warnings, infos, totalIssues: issues.length };
}

/**
 * Helper for analyze-backed commands (check, ci) to build the envelope
 * from an AnalysisResult without duplicating conversion logic.
 */
export function envelopeFromAnalysis(
  command: string,
  result: AnalysisResult,
  options: {
    root: string;
    framework?: BuildEnvelopeInput["framework"];
    exitCode: number;
    data?: Record<string, unknown>;
    now?: Date;
  },
): JsonEnvelope {
  return buildJsonEnvelope({
    command,
    root: options.root,
    framework: options.framework,
    issues: result.issues.map(toSchemaIssue),
    exitCode: options.exitCode,
    data: options.data,
    now: options.now,
  });
}

/**
 * Serialize an envelope to a stable JSON string. Keys in the top-level
 * envelope are emitted in a deterministic order.
 */
export function serializeEnvelope(envelope: JsonEnvelope): string {
  // JSON.stringify already preserves insertion order for plain objects,
  // and buildJsonEnvelope inserts keys in the canonical order, so we
  // can rely on a simple stringify here.
  return JSON.stringify(envelope, null, 2);
}

/**
 * Map a legacy Summary to the schema summary shape.
 */
export function legacySummaryToSchemaSummary(s: Summary): {
  errors: number;
  warnings: number;
  infos: number;
  totalIssues: number;
} {
  return {
    errors: s.errors,
    warnings: s.warnings,
    infos: s.infos,
    totalIssues: s.errors + s.warnings + s.infos,
  };
}
