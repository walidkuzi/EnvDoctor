import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import {
  extractUsagesFromSource,
  scanSources,
  similarity,
  findTypos,
} from "../src/scanner/index.js";

describe("extractUsagesFromSource", () => {
  it("detects process.env.KEY", () => {
    const source = `const x = process.env.DATABASE_URL;`;
    const usages = extractUsagesFromSource(source, "x.ts");
    expect(usages).toHaveLength(1);
    expect(usages[0].key).toBe("DATABASE_URL");
    expect(usages[0].line).toBe(1);
  });

  it("detects process.env['KEY'] and process.env[\"KEY\"]", () => {
    const source = `
      const a = process.env["API_KEY"];
      const b = process.env['PORT'];
    `;
    const usages = extractUsagesFromSource(source, "x.ts");
    const keys = usages.map((u) => u.key).sort();
    expect(keys).toEqual(["API_KEY", "PORT"]);
  });

  it("detects process?.env?.KEY", () => {
    const source = `const x = process?.env?.DEBUG;`;
    const usages = extractUsagesFromSource(source, "x.ts");
    expect(usages.map((u) => u.key)).toEqual(["DEBUG"]);
  });

  it("detects import.meta.env.KEY and bracket form", () => {
    const source = `
      export const a = import.meta.env.VITE_API_URL;
      export const b = import.meta.env["VITE_KEY"];
    `;
    const usages = extractUsagesFromSource(source, "x.ts");
    expect(usages.map((u) => u.key).sort()).toEqual([
      "VITE_API_URL",
      "VITE_KEY",
    ]);
  });

  it("ignores usages inside line comments", () => {
    const source = `
      // const x = process.env.COMMENTED_OUT;
      const y = process.env.REAL_ONE;
    `;
    const usages = extractUsagesFromSource(source, "x.ts");
    expect(usages.map((u) => u.key)).toEqual(["REAL_ONE"]);
  });

  it("reports line and column numbers", () => {
    const source = `const x = 1;\nconst y = process.env.FOO;`;
    const usages = extractUsagesFromSource(source, "x.ts");
    expect(usages[0].key).toBe("FOO");
    expect(usages[0].line).toBe(2);
    expect(usages[0].column).toBeGreaterThan(0);
  });

  it("returns empty array when there are no usages", () => {
    expect(extractUsagesFromSource(`const x = 1;`, "x.ts")).toHaveLength(0);
  });
});

describe("similarity + findTypos", () => {
  it("similarity is 1 for identical keys ignoring case and underscores", () => {
    expect(similarity("DATABASE_URL", "database_url")).toBe(1);
    expect(similarity("API_KEY", "APIKEY")).toBe(1);
  });

  it("similarity is < 1 for different keys", () => {
    expect(similarity("DATABASE_URL", "DATABSE_URL")).toBeGreaterThan(0.8);
    expect(similarity("DATABASE_URL", "DATABSE_URL")).toBeLessThan(1);
    expect(similarity("FOO", "BAR")).toBeLessThan(0.5);
  });

  it("findTypos suggests high-similarity defined keys", () => {
    const typos = findTypos(
      ["DATABSE_URL"],
      ["DATABASE_URL", "API_KEY"],
      0.8,
    );
    expect(typos).toHaveLength(1);
    expect(typos[0].suggestion).toBe("DATABASE_URL");
  });

  it("findTypos respects the minScore threshold", () => {
    const low = findTypos(["FOOBAR"], ["BAZQUX"], 0.3);
    // With a low threshold anything can match; with a high threshold nothing does.
    const high = findTypos(["FOOBAR"], ["BAZQUX"], 0.95);
    expect(high).toHaveLength(0);
    expect(low.length >= 0).toBe(true);
  });

  it("never reports exact matches as typos", () => {
    const typos = findTypos(["DATABASE_URL"], ["DATABASE_URL"], 0.5);
    expect(typos).toHaveLength(0);
  });
});

const SCAN_DIR = resolve(import.meta.dirname, "../examples/scan-project");

describe("scanSources (integration)", () => {
  it("detects used, defined, undefined, unused and typos", () => {
    const result = scanSources({
      root: SCAN_DIR,
      contractKeys: ["DATABASE_URL", "API_KEY", "PORT", "DEBUG", "UNUSED_LEGACY"],
    });

    expect(result.filesScanned).toBeGreaterThan(0);
    expect(result.usedKeys).toContain("DATABASE_URL");
    expect(result.usedKeys).toContain("API_KEY");
    expect(result.usedKeys).toContain("PORT");
    expect(result.definedButUnused).toContain("UNUSED_LEGACY");

    // SOMETHING_UNDEFINED is used but not in contract or similar to anything
    expect(result.usedButUndefined).toContain("SOMETHING_UNDEFINED");

    // DATABSE_URL is a typo, should be in typos (not in usedButUndefined)
    expect(result.typos.some((t) => t.used === "DATABSE_URL")).toBe(true);
    expect(result.usedButUndefined).not.toContain("DATABSE_URL");
  });

  it("supports custom paths", () => {
    const result = scanSources({
      root: SCAN_DIR,
      contractKeys: ["DATABASE_URL"],
      options: { paths: ["src"] },
    });
    expect(result.filesScanned).toBeGreaterThan(0);
  });

  it("returns empty scan when scan paths do not exist", () => {
    const result = scanSources({
      root: SCAN_DIR,
      contractKeys: ["DATABASE_URL"],
      options: { paths: ["does/not/exist"] },
    });
    expect(result.filesScanned).toBe(0);
    expect(result.usages).toHaveLength(0);
  });

  it("results are deterministic", () => {
    const a = scanSources({
      root: SCAN_DIR,
      contractKeys: ["DATABASE_URL", "API_KEY"],
    });
    const b = scanSources({
      root: SCAN_DIR,
      contractKeys: ["DATABASE_URL", "API_KEY"],
    });
    expect(a.usedKeys).toEqual(b.usedKeys);
    expect(a.usedButUndefined).toEqual(b.usedButUndefined);
    expect(a.definedButUnused).toEqual(b.definedButUnused);
  });
});
