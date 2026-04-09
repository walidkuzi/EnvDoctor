import { describe, it, expect } from "vitest";
import { renderJSONAnalysis, renderJSONDiff, renderJSONExplain, renderJSONMatrix } from "../src/reporter/json.js";
import type { AnalysisResult, ExplainResult, MultiEnvResult } from "../src/types.js";
import type { DiffResult } from "../src/core/diff.js";

describe("JSON output", () => {
  it("renderJSONAnalysis produces valid JSON", () => {
    const result: AnalysisResult = {
      issues: [
        { kind: "missing", severity: "error", key: "FOO", message: "FOO is missing" },
      ],
      summary: { errors: 1, warnings: 0, infos: 0, total: 1, valid: 0 },
    };

    const output = renderJSONAnalysis(result, "check");
    const parsed = JSON.parse(output);

    expect(parsed.version).toBeDefined();
    expect(parsed.command).toBe("check");
    expect(parsed.ok).toBe(false);
    expect(parsed.issues).toHaveLength(1);
    expect(parsed.summary.errors).toBe(1);
  });

  it("renderJSONDiff produces valid JSON", () => {
    const diff: DiffResult = {
      onlyInExample: ["A"],
      onlyInEnv: ["B"],
      inBoth: ["C"],
    };

    const output = renderJSONDiff(diff);
    const parsed = JSON.parse(output);

    expect(parsed.command).toBe("diff");
    expect(parsed.ok).toBe(false);
    expect(parsed.onlyInExample).toEqual(["A"]);
    expect(parsed.onlyInEnv).toEqual(["B"]);
    expect(parsed.inBoth).toEqual(["C"]);
  });

  it("renderJSONExplain produces valid JSON", () => {
    const result: ExplainResult = {
      key: "PORT",
      existsInExample: true,
      existsInEnv: true,
      exampleValue: "3000",
      envValue: "3000",
      isEmpty: false,
      isRequired: false,
      expectedType: { type: "port", source: "inferred" },
      issues: [],
    };

    const output = renderJSONExplain(result);
    const parsed = JSON.parse(output);

    expect(parsed.command).toBe("explain");
    expect(parsed.key).toBe("PORT");
    expect(parsed.expectedType.type).toBe("port");
  });

  it("renderJSONMatrix produces valid JSON", () => {
    const result: MultiEnvResult = {
      keys: ["A", "B"],
      files: [".env", ".env.example"],
      matrix: [
        { key: "A", files: { ".env": "1", ".env.example": "x" } },
        { key: "B", files: { ".env": "2", ".env.example": null } },
      ],
    };

    const output = renderJSONMatrix(result);
    const parsed = JSON.parse(output);

    expect(parsed.command).toBe("matrix");
    expect(parsed.keys).toEqual(["A", "B"]);
    expect(parsed.matrix).toHaveLength(2);
  });

  it("ok is true when no errors", () => {
    const result: AnalysisResult = {
      issues: [],
      summary: { errors: 0, warnings: 0, infos: 0, total: 5, valid: 5 },
    };

    const output = renderJSONAnalysis(result, "check");
    const parsed = JSON.parse(output);
    expect(parsed.ok).toBe(true);
  });
});
