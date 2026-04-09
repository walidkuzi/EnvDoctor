import { describe, it, expect } from "vitest";
import { explain } from "../src/core/explain.js";
import { parseEnvContent } from "../src/parser/env.js";
import type { Config } from "../src/types.js";

function run(key: string, envContent: string, exampleContent: string, config: Config | null = null) {
  return explain({
    key,
    envEntries: parseEnvContent(envContent).entries,
    exampleEntries: parseEnvContent(exampleContent).entries,
    config,
  });
}

describe("explain", () => {
  it("reports a variable found in both files", () => {
    const result = run("PORT", "PORT=3000", "PORT=3000");
    expect(result.existsInEnv).toBe(true);
    expect(result.existsInExample).toBe(true);
    expect(result.envValue).toBe("3000");
    expect(result.issues).toHaveLength(0);
  });

  it("reports a missing variable", () => {
    const result = run("DB_URL", "", "DB_URL=postgres://localhost/db");
    expect(result.existsInEnv).toBe(false);
    expect(result.existsInExample).toBe(true);
    expect(result.isRequired).toBe(true);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.suggestion).toBeDefined();
  });

  it("reports an empty variable", () => {
    const result = run("API_KEY", "API_KEY=", "API_KEY=sk-123");
    expect(result.isEmpty).toBe(true);
    expect(result.issues.some((i) => i.kind === "empty")).toBe(true);
  });

  it("reports variable only in env", () => {
    const result = run("EXTRA", "EXTRA=value", "");
    expect(result.existsInEnv).toBe(true);
    expect(result.existsInExample).toBe(false);
    expect(result.isRequired).toBe(false);
  });

  it("reports variable not found anywhere", () => {
    const result = run("NONEXISTENT", "FOO=bar", "BAZ=qux");
    expect(result.existsInEnv).toBe(false);
    expect(result.existsInExample).toBe(false);
    expect(result.isRequired).toBe(false);
  });

  it("suggests closest match for unknown variable", () => {
    const result = run("DATABSE_URL", "", "DATABASE_URL=postgres://...");
    expect(result.closestMatch).toBe("DATABASE_URL");
  });

  it("respects config required keys", () => {
    const result = run("MY_VAR", "", "", { required: ["MY_VAR"] });
    expect(result.isRequired).toBe(true);
    expect(result.issues.some((i) => i.kind === "missing")).toBe(true);
  });

  it("includes expected type from config", () => {
    const result = run("PORT", "PORT=3000", "PORT=3000", {
      types: { PORT: "port" },
    });
    expect(result.expectedType).toBeDefined();
    expect(result.expectedType!.type).toBe("port");
    expect(result.expectedType!.source).toBe("config");
  });

  it("includes inferred type", () => {
    const result = run("PORT", "PORT=3000", "PORT=3000");
    expect(result.expectedType).toBeDefined();
    expect(result.expectedType!.type).toBe("port");
    expect(result.expectedType!.source).toBe("inferred");
  });

  it("reports invalid type", () => {
    const result = run("PORT", "PORT=abc", "PORT=3000");
    expect(result.issues.some((i) => i.kind === "invalid_type")).toBe(true);
  });

  it("reports dangerous values", () => {
    const result = run("JWT_SECRET", "JWT_SECRET=123", "JWT_SECRET=xxx");
    const flagged = result.issues.filter(
      (i) => i.kind === "dangerous_value" || i.kind === "placeholder_value",
    );
    expect(flagged.length).toBeGreaterThan(0);
  });
});
