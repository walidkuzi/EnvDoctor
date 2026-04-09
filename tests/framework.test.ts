import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { detectFramework, checkFrameworkIssues } from "../src/framework/index.js";
import type { EnvEntry, FrameworkInfo } from "../src/types.js";

const NEXTJS_DIR = resolve(import.meta.dirname, "../examples/nextjs-project");
const VALID_DIR = resolve(import.meta.dirname, "../examples/valid-project");

function makeEntries(keys: string[]): EnvEntry[] {
  return keys.map((key, i) => ({
    key,
    value: "some-value",
    line: i + 1,
    raw: `${key}=some-value`,
  }));
}

const NEXTJS_INFO: FrameworkInfo = {
  id: "nextjs",
  name: "Next.js",
  publicPrefix: "NEXT_PUBLIC_",
};

const VITE_INFO: FrameworkInfo = {
  id: "vite",
  name: "Vite",
  publicPrefix: "VITE_",
};

describe("detectFramework", () => {
  it("detects Next.js from package.json", () => {
    const result = detectFramework(NEXTJS_DIR);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("nextjs");
  });

  it("returns null when no framework detected", () => {
    const result = detectFramework(VALID_DIR);
    expect(result).toBeNull();
  });

  it("respects 'none' config hint", () => {
    const result = detectFramework(NEXTJS_DIR, "none");
    expect(result).toBeNull();
  });

  it("respects explicit framework hint", () => {
    const result = detectFramework(VALID_DIR, "vite");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("vite");
  });
});

describe("checkFrameworkIssues", () => {
  it("warns about secrets with public prefix in Next.js", () => {
    const entries = makeEntries(["NEXT_PUBLIC_API_KEY", "NEXT_PUBLIC_APP_NAME"]);
    const issues = checkFrameworkIssues(entries, NEXTJS_INFO);
    // NEXT_PUBLIC_API_KEY contains "KEY" which is secret-like
    const secretWarning = issues.find((i) => i.key === "NEXT_PUBLIC_API_KEY");
    expect(secretWarning).toBeDefined();
    expect(secretWarning!.severity).toBe("warning");
    // NEXT_PUBLIC_APP_NAME is not secret-like, no warning
    expect(issues.find((i) => i.key === "NEXT_PUBLIC_APP_NAME")).toBeUndefined();
  });

  it("warns about secrets with public prefix in Vite", () => {
    const entries = makeEntries(["VITE_SECRET_TOKEN"]);
    const issues = checkFrameworkIssues(entries, VITE_INFO);
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe("framework_warning");
  });

  it("suggests public prefix for client-like variables", () => {
    const entries = makeEntries(["PUBLIC_ANALYTICS_ID"]);
    const issues = checkFrameworkIssues(entries, NEXTJS_INFO);
    const hint = issues.find((i) => i.key === "PUBLIC_ANALYTICS_ID");
    expect(hint).toBeDefined();
    expect(hint!.severity).toBe("info");
  });

  it("does not suggest public prefix for server-only variables", () => {
    const entries = makeEntries(["DATABASE_URL", "REDIS_HOST"]);
    const issues = checkFrameworkIssues(entries, NEXTJS_INFO);
    expect(issues).toHaveLength(0);
  });

  it("does not generate false positives for normal variables", () => {
    const entries = makeEntries(["PORT", "NODE_ENV", "APP_NAME", "DEBUG"]);
    const issues = checkFrameworkIssues(entries, NEXTJS_INFO);
    expect(issues).toHaveLength(0);
  });
});
