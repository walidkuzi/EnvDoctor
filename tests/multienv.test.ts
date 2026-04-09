import { describe, it, expect } from "vitest";
import { buildMultiEnvMatrix, getEnvFileList } from "../src/core/multienv.js";
import { parseEnvContent } from "../src/parser/env.js";

describe("getEnvFileList", () => {
  it("returns defaults when no config", () => {
    const list = getEnvFileList();
    expect(list).toContain(".env");
    expect(list).toContain(".env.example");
    expect(list).toContain(".env.production");
  });

  it("returns config files when provided", () => {
    const list = getEnvFileList([".env", ".env.staging"]);
    expect(list).toEqual([".env", ".env.staging"]);
  });
});

describe("buildMultiEnvMatrix", () => {
  it("builds a matrix from multiple files", () => {
    const files = new Map([
      [".env", parseEnvContent("A=1\nB=2")],
      [".env.example", parseEnvContent("A=x\nC=z")],
    ]);

    const result = buildMultiEnvMatrix({ files });

    expect(result.files).toEqual([".env", ".env.example"]);
    expect(result.keys).toEqual(["A", "B", "C"]);
    expect(result.matrix).toHaveLength(3);

    // A exists in both
    const aEntry = result.matrix.find((e) => e.key === "A")!;
    expect(aEntry.files[".env"]).toBe("1");
    expect(aEntry.files[".env.example"]).toBe("x");

    // B only in .env
    const bEntry = result.matrix.find((e) => e.key === "B")!;
    expect(bEntry.files[".env"]).toBe("2");
    expect(bEntry.files[".env.example"]).toBeNull();

    // C only in .env.example
    const cEntry = result.matrix.find((e) => e.key === "C")!;
    expect(cEntry.files[".env"]).toBeNull();
    expect(cEntry.files[".env.example"]).toBe("z");
  });

  it("handles empty input", () => {
    const result = buildMultiEnvMatrix({ files: new Map() });
    expect(result.keys).toEqual([]);
    expect(result.files).toEqual([]);
    expect(result.matrix).toEqual([]);
  });

  it("handles single file", () => {
    const files = new Map([
      [".env", parseEnvContent("A=1\nB=2")],
    ]);
    const result = buildMultiEnvMatrix({ files });
    expect(result.keys).toEqual(["A", "B"]);
    expect(result.files).toEqual([".env"]);
  });
});
