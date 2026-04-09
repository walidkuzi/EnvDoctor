export interface EnvEntry {
  key: string;
  value: string;
  line: number;
  raw: string;
}

export type ValueType = "string" | "number" | "boolean" | "url";

export type IssueKind =
  | "missing"
  | "extra"
  | "empty"
  | "invalid_type"
  | "dangerous_value"
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

export interface Config {
  types?: Record<string, ValueType>;
  required?: string[];
  dangerousValues?: string[];
}

export const EXIT_OK = 0;
export const EXIT_ISSUES = 1;
export const EXIT_ERROR = 2;
