export interface EnvEntry {
  key: string;
  value: string;
  line: number;
  raw: string;
}

export type ValueType = "string" | "number" | "boolean" | "url" | "port" | "enum" | "email";

export type IssueKind =
  | "missing"
  | "extra"
  | "empty"
  | "invalid_type"
  | "invalid_enum"
  | "dangerous_value"
  | "placeholder_value"
  | "framework_warning"
  | "parse_warning";

export type Severity = "error" | "warning" | "info";

export interface Issue {
  kind: IssueKind;
  severity: Severity;
  key: string;
  message: string;
  hint?: string;
  example?: string;
}

export interface ParseWarning {
  line: number;
  raw: string;
  message: string;
}

export interface ParseResult {
  entries: EnvEntry[];
  warnings: ParseWarning[];
}

export interface AnalysisResult {
  issues: Issue[];
  summary: Summary;
}

export interface Summary {
  errors: number;
  warnings: number;
  infos: number;
  total: number;
  valid: number;
}

// --- Config types ---

export interface EnumTypeConfig {
  type: "enum";
  values: string[];
}

export type TypeConfigValue = ValueType | EnumTypeConfig;

export interface Config {
  types?: Record<string, TypeConfigValue>;
  required?: string[];
  dangerousValues?: string[];
  framework?: "auto" | "nextjs" | "vite" | "none";
  files?: string[];
}

// --- Multi-env types ---

export interface MultiEnvEntry {
  key: string;
  files: Record<string, string | null>; // filename -> value or null if absent
}

export interface MultiEnvResult {
  keys: string[];
  files: string[];
  matrix: MultiEnvEntry[];
}

// --- Explain types ---

export interface ExplainResult {
  key: string;
  existsInExample: boolean;
  existsInEnv: boolean;
  exampleValue?: string;
  envValue?: string;
  isEmpty: boolean;
  isRequired: boolean;
  expectedType?: ResolvedType;
  issues: Issue[];
  suggestion?: string;
  closestMatch?: string;
}

export interface ResolvedType {
  type: ValueType;
  source: "config" | "inferred";
  enumValues?: string[];
}

// --- Inference types ---

export interface InferredMeta {
  key: string;
  type: ValueType;
  enumValues?: string[];
  source: "value" | "name" | "config";
  confidence: "high" | "medium" | "low";
}

// --- Framework types ---

export type FrameworkId = "nextjs" | "vite" | "none";

export interface FrameworkInfo {
  id: FrameworkId;
  name: string;
  publicPrefix: string;
}

// --- JSON output types ---

export interface JSONOutput {
  version: string;
  command: string;
  ok: boolean;
  issues: Issue[];
  summary: Summary;
  meta?: Record<string, unknown>;
}

// --- Exit codes ---

export const EXIT_OK = 0;
export const EXIT_ISSUES = 1;
export const EXIT_ERROR = 2;
