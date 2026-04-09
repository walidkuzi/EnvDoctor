import type {
  AnalysisResult,
  ExplainResult,
  JSONOutput,
  MultiEnvResult,
} from "../types.js";
import type { DiffResult } from "../core/diff.js";

const VERSION = "0.2.0";

export function renderJSONAnalysis(result: AnalysisResult, command: string): string {
  const output: JSONOutput = {
    version: VERSION,
    command,
    ok: result.summary.errors === 0,
    issues: result.issues,
    summary: result.summary,
  };
  return JSON.stringify(output, null, 2);
}

export function renderJSONDiff(diff: DiffResult): string {
  return JSON.stringify(
    {
      version: VERSION,
      command: "diff",
      ok: diff.onlyInExample.length === 0,
      onlyInExample: diff.onlyInExample,
      onlyInEnv: diff.onlyInEnv,
      inBoth: diff.inBoth,
    },
    null,
    2,
  );
}

export function renderJSONExplain(result: ExplainResult): string {
  return JSON.stringify(
    {
      version: VERSION,
      command: "explain",
      ...result,
    },
    null,
    2,
  );
}

export function renderJSONMatrix(result: MultiEnvResult): string {
  return JSON.stringify(
    {
      version: VERSION,
      command: "matrix",
      files: result.files,
      keys: result.keys,
      matrix: result.matrix,
    },
    null,
    2,
  );
}
