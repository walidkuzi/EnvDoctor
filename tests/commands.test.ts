import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { checkCommand } from "../src/cli/commands/check.js";
import { diffCommand } from "../src/cli/commands/diff.js";
import { validateCommand } from "../src/cli/commands/validate.js";
import { ciCommand } from "../src/cli/commands/ci.js";
import { EXIT_OK, EXIT_ISSUES, EXIT_ERROR } from "../src/types.js";

const VALID_DIR = resolve(import.meta.dirname, "../examples/valid-project");
const BROKEN_DIR = resolve(import.meta.dirname, "../examples/broken-project");
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
});

describe("diff command", () => {
  it("returns 0 for valid project", () => {
    expect(diffCommand(VALID_DIR)).toBe(EXIT_OK);
  });

  it("returns 1 for broken project with missing keys", () => {
    expect(diffCommand(BROKEN_DIR)).toBe(EXIT_ISSUES);
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
});
