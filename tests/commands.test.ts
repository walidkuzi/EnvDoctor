import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { checkCommand } from "../src/cli/commands/check.js";
import { diffCommand } from "../src/cli/commands/diff.js";
import { validateCommand } from "../src/cli/commands/validate.js";
import { ciCommand } from "../src/cli/commands/ci.js";
import { explainCommand } from "../src/cli/commands/explain.js";
import { matrixCommand } from "../src/cli/commands/matrix.js";
import { EXIT_OK, EXIT_ISSUES, EXIT_ERROR } from "../src/types.js";

const VALID_DIR = resolve(import.meta.dirname, "../examples/valid-project");
const BROKEN_DIR = resolve(import.meta.dirname, "../examples/broken-project");
const NEXTJS_DIR = resolve(import.meta.dirname, "../examples/nextjs-project");
const EMPTY_DIR = resolve(import.meta.dirname, "../examples"); // no .env files

describe("check command", () => {
  it("returns 0 for valid project", () => {
    expect(checkCommand(VALID_DIR)).toBe(EXIT_OK);
  });

  it("returns 1 for broken project", () => {
    expect(checkCommand(BROKEN_DIR)).toBe(EXIT_ISSUES);
  });

  it("returns 2 when .env.example is missing", () => {
    expect(checkCommand(EMPTY_DIR)).toBe(EXIT_ERROR);
  });

  it("supports --json flag", () => {
    expect(checkCommand(VALID_DIR, { json: true })).toBe(EXIT_OK);
  });

  it("supports --fail-on-warning flag", () => {
    // broken project has warnings, so should fail
    expect(checkCommand(BROKEN_DIR, { failOnWarning: true })).toBe(EXIT_ISSUES);
  });
});

describe("diff command", () => {
  it("returns 0 for valid project", () => {
    expect(diffCommand(VALID_DIR)).toBe(EXIT_OK);
  });

  it("returns 1 for broken project with missing keys", () => {
    expect(diffCommand(BROKEN_DIR)).toBe(EXIT_ISSUES);
  });

  it("supports --json flag", () => {
    expect(diffCommand(VALID_DIR, { json: true })).toBe(EXIT_OK);
  });
});

describe("validate command", () => {
  it("returns 0 for valid project", () => {
    expect(validateCommand(VALID_DIR)).toBe(EXIT_OK);
  });

  it("returns 1 for broken project with invalid types", () => {
    expect(validateCommand(BROKEN_DIR)).toBe(EXIT_ISSUES);
  });
});

describe("ci command", () => {
  it("returns 0 for valid project", () => {
    expect(ciCommand(VALID_DIR)).toBe(EXIT_OK);
  });

  it("returns 1 for broken project", () => {
    expect(ciCommand(BROKEN_DIR)).toBe(EXIT_ISSUES);
  });

  it("returns 2 when files are missing", () => {
    expect(ciCommand(EMPTY_DIR)).toBe(EXIT_ERROR);
  });

  it("supports --quiet flag", () => {
    expect(ciCommand(VALID_DIR, { quiet: true })).toBe(EXIT_OK);
  });

  it("supports --json flag", () => {
    expect(ciCommand(BROKEN_DIR, { json: true })).toBe(EXIT_ISSUES);
  });
});

describe("explain command", () => {
  it("returns 0 for variable with no issues", () => {
    expect(explainCommand(VALID_DIR, "APP_NAME")).toBe(EXIT_OK);
  });

  it("returns 1 for missing variable", () => {
    expect(explainCommand(BROKEN_DIR, "DATABASE_URL")).toBe(EXIT_ISSUES);
  });

  it("returns 0 for nonexistent variable not required", () => {
    expect(explainCommand(VALID_DIR, "NONEXISTENT")).toBe(EXIT_OK);
  });

  it("supports --json flag", () => {
    expect(explainCommand(VALID_DIR, "PORT", { json: true })).toBe(EXIT_OK);
  });
});

describe("matrix command", () => {
  it("returns 0 when env files exist", () => {
    expect(matrixCommand(VALID_DIR)).toBe(EXIT_OK);
  });

  it("shows multiple files for nextjs project", () => {
    expect(matrixCommand(NEXTJS_DIR)).toBe(EXIT_OK);
  });

  it("returns 2 when no env files found", () => {
    // Use an empty temp-like dir with no env files
    expect(matrixCommand(resolve(import.meta.dirname))).toBe(EXIT_ERROR);
  });

  it("supports --json flag", () => {
    expect(matrixCommand(VALID_DIR, { json: true })).toBe(EXIT_OK);
  });
});
