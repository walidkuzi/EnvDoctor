import { describe, it, expect } from "vitest";
import { diffEntries } from "../src/core/diff.js";
import { parseEnvContent } from "../src/parser/env.js";

function run(envContent: string, exampleContent: string) {
  const env = parseEnvContent(envContent);
  const example = parseEnvContent(exampleContent);
  return diffEntries(env.entries, example.entries);
}

describe("diffEntries", () => {
  it("returns all in both when keys match", () => {
    const result = run("A=1\nB=2", "A=x\nB=y");
    expect(result.inBoth).toEqual(["A", "B"]);
    expect(result.onlyInExample).toEqual([]);
    expect(result.onlyInEnv).toEqual([]);
  });

  it("detects keys only in example", () => {
    const result = run("A=1", "A=x\nB=y");
    expect(result.onlyInExample).toEqual(["B"]);
  });

  it("detects keys only in env", () => {
    const result = run("A=1\nC=3", "A=x");
    expect(result.onlyInEnv).toEqual(["C"]);
  });

  it("handles empty files", () => {
    const result = run("", "A=1");
    expect(result.onlyInExample).toEqual(["A"]);
    expect(result.inBoth).toEqual([]);
  });
});
