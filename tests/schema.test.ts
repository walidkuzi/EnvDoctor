import { describe, it, expect } from "vitest";
import {
  SCHEMA_VERSION,
  TOOL_VERSION,
  buildJsonEnvelope,
  toSchemaIssue,
  computeSchemaSummary,
  serializeEnvelope,
} from "../src/output/index.js";
import type { Issue } from "../src/types.js";

describe("schema constants", () => {
  it("SCHEMA_VERSION is 1.0.0", () => {
    expect(SCHEMA_VERSION).toBe("1.0.0");
  });
  it("TOOL_VERSION is 0.3.0", () => {
    expect(TOOL_VERSION).toBe("0.3.0");
  });
});

describe("buildJsonEnvelope", () => {
  it("produces a complete envelope with required top-level fields", () => {
    const env = buildJsonEnvelope({
      command: "check",
      root: "/tmp/x",
      exitCode: 0,
      now: new Date("2026-04-10T00:00:00.000Z"),
    });

    expect(env.schemaVersion).toBe("1.0.0");
    expect(env.toolVersion).toBe("0.3.0");
    expect(env.command).toBe("check");
    expect(env.ok).toBe(true);
    expect(env.timestamp).toBe("2026-04-10T00:00:00.000Z");
    expect(env.project.root).toBe("/tmp/x");
    expect(env.project.framework).toBe("unknown");
    expect(env.issues).toEqual([]);
    expect(env.actions).toEqual([]);
    expect(env.summary).toEqual({
      errors: 0,
      warnings: 0,
      infos: 0,
      totalIssues: 0,
    });
    expect(env.exitCode).toBe(0);
  });

  it("marks ok=false when there are errors", () => {
    const env = buildJsonEnvelope({
      command: "check",
      root: "/tmp/x",
      exitCode: 1,
      issues: [
        {
          code: "MISSING",
          kind: "missing",
          severity: "error",
          key: "FOO",
          message: "FOO missing",
        },
      ],
    });
    expect(env.ok).toBe(false);
    expect(env.summary.errors).toBe(1);
    expect(env.summary.totalIssues).toBe(1);
  });

  it("ok=true when only warnings", () => {
    const env = buildJsonEnvelope({
      command: "scan",
      root: "/tmp/x",
      exitCode: 0,
      issues: [
        {
          code: "DEFINED_BUT_UNUSED",
          kind: "unused",
          severity: "warning",
          key: "BAR",
          message: "BAR unused",
        },
      ],
    });
    expect(env.ok).toBe(true);
    expect(env.summary.warnings).toBe(1);
  });

  it("honors custom exitCode independently of ok", () => {
    const env = buildJsonEnvelope({
      command: "fix",
      root: "/tmp/x",
      exitCode: 2,
    });
    expect(env.exitCode).toBe(2);
  });

  it("includes data only when provided", () => {
    const envWithData = buildJsonEnvelope({
      command: "scan",
      root: "/tmp",
      exitCode: 0,
      data: { filesScanned: 5 },
    });
    expect(envWithData.data).toEqual({ filesScanned: 5 });

    const envNoData = buildJsonEnvelope({
      command: "scan",
      root: "/tmp",
      exitCode: 0,
    });
    expect(envNoData.data).toBeUndefined();
  });
});

describe("toSchemaIssue", () => {
  it("maps each legacy issue kind to a stable code", () => {
    const cases: { issue: Issue; code: string }[] = [
      {
        issue: { kind: "missing", severity: "error", key: "X", message: "m" },
        code: "MISSING",
      },
      {
        issue: { kind: "extra", severity: "info", key: "X", message: "m" },
        code: "EXTRA",
      },
      {
        issue: { kind: "empty", severity: "warning", key: "X", message: "m" },
        code: "EMPTY",
      },
      {
        issue: {
          kind: "invalid_type",
          severity: "warning",
          key: "X",
          message: "m",
        },
        code: "INVALID_TYPE",
      },
      {
        issue: {
          kind: "dangerous_value",
          severity: "warning",
          key: "X",
          message: "m",
        },
        code: "DANGEROUS_VALUE",
      },
      {
        issue: {
          kind: "placeholder_value",
          severity: "warning",
          key: "X",
          message: "m",
        },
        code: "PLACEHOLDER_VALUE",
      },
      {
        issue: {
          kind: "framework_warning",
          severity: "warning",
          key: "X",
          message: "m",
        },
        code: "FRAMEWORK_WARNING",
      },
    ];
    for (const c of cases) {
      expect(toSchemaIssue(c.issue).code).toBe(c.code);
    }
  });
});

describe("computeSchemaSummary", () => {
  it("aggregates severities", () => {
    expect(
      computeSchemaSummary([
        { code: "MISSING", kind: "missing", severity: "error", key: "A", message: "" },
        {
          code: "DEFINED_BUT_UNUSED",
          kind: "unused",
          severity: "warning",
          key: "B",
          message: "",
        },
        {
          code: "DEFINED_BUT_UNUSED",
          kind: "unused",
          severity: "warning",
          key: "C",
          message: "",
        },
        { code: "EXTRA", kind: "extra", severity: "info", key: "D", message: "" },
      ]),
    ).toEqual({ errors: 1, warnings: 2, infos: 1, totalIssues: 4 });
  });
});

describe("serializeEnvelope", () => {
  it("produces valid pretty-printed JSON", () => {
    const env = buildJsonEnvelope({
      command: "check",
      root: "/r",
      exitCode: 0,
    });
    const s = serializeEnvelope(env);
    expect(s).toContain("\n");
    expect(JSON.parse(s)).toEqual(env);
  });
});
