import { describe, it, expect } from "vitest";
import { analyze } from "../src/core/analyze.js";
import { parseEnvContent } from "../src/parser/env.js";

function run(envContent: string, exampleContent: string, config = null) {
  return analyze({
    env: parseEnvContent(envContent),
    example: parseEnvContent(exampleContent),
    config,
  });
}

describe("analyze", () => {
  it("reports no issues when env matches example", () => {
    const result = run("FOO=bar\nBAZ=qux", "FOO=bar\nBAZ=qux");
    expect(result.issues).toHaveLength(0);
    expect(result.summary.errors).toBe(0);
  });

  it("reports missing variables", () => {
    const result = run("FOO=bar", "FOO=bar\nMISSING=value");
    const missing = result.issues.filter((i) => i.kind === "missing");
    expect(missing).toHaveLength(1);
    expect(missing[0].key).toBe("MISSING");
    expect(missing[0].severity).toBe("error");
  });

  it("reports extra variables", () => {
    const result = run("FOO=bar\nEXTRA=value", "FOO=bar");
    const extra = result.issues.filter((i) => i.kind === "extra");
    expect(extra).toHaveLength(1);
    expect(extra[0].key).toBe("EXTRA");
    expect(extra[0].severity).toBe("info");
  });

  it("reports empty values", () => {
    const result = run("FOO=", "FOO=bar");
    const empty = result.issues.filter((i) => i.kind === "empty");
    expect(empty).toHaveLength(1);
    expect(empty[0].key).toBe("FOO");
  });

  it("reports invalid types from inference", () => {
    const result = run("PORT=abc", "PORT=3000");
    const invalid = result.issues.filter((i) => i.kind === "invalid_type");
    expect(invalid).toHaveLength(1);
    expect(invalid[0].key).toBe("PORT");
  });

  it("reports dangerous values", () => {
    const result = run("JWT_SECRET=123", "JWT_SECRET=your_secret_here");
    const dangerous = result.issues.filter((i) => i.kind === "dangerous_value");
    expect(dangerous).toHaveLength(1);
    expect(dangerous[0].key).toBe("JWT_SECRET");
  });

  it("uses config types over inference", () => {
    const result = run("PORT=abc", "PORT=something", {
      types: { PORT: "number" },
    });
    const invalid = result.issues.filter((i) => i.kind === "invalid_type");
    expect(invalid).toHaveLength(1);
  });

  it("uses config required keys", () => {
    const result = run("FOO=bar", "FOO=bar", {
      required: ["EXTRA_REQUIRED"],
    });
    const missing = result.issues.filter((i) => i.kind === "missing");
    expect(missing).toHaveLength(1);
    expect(missing[0].key).toBe("EXTRA_REQUIRED");
  });

  it("uses config dangerousValues", () => {
    const result = run("API_KEY=custom_bad", "API_KEY=real_key", {
      dangerousValues: ["custom_bad"],
    });
    const dangerous = result.issues.filter((i) => i.kind === "dangerous_value");
    expect(dangerous).toHaveLength(1);
  });

  it("does not flag valid values as dangerous", () => {
    const result = run(
      "APP_NAME=my-production-app",
      "APP_NAME=my-app",
    );
    const dangerous = result.issues.filter((i) => i.kind === "dangerous_value");
    expect(dangerous).toHaveLength(0);
  });
});
