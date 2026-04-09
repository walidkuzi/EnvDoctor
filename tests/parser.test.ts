import { describe, it, expect } from "vitest";
import { parseEnvContent } from "../src/parser/env.js";

describe("parseEnvContent", () => {
  it("parses basic key-value pairs", () => {
    const result = parseEnvContent("FOO=bar\nBAZ=qux");
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toMatchObject({ key: "FOO", value: "bar" });
    expect(result.entries[1]).toMatchObject({ key: "BAZ", value: "qux" });
  });

  it("skips comments and blank lines", () => {
    const result = parseEnvContent("# comment\n\nFOO=bar\n  \n# another comment");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].key).toBe("FOO");
  });

  it("handles double-quoted values", () => {
    const result = parseEnvContent('KEY="hello world"');
    expect(result.entries[0].value).toBe("hello world");
  });

  it("handles single-quoted values", () => {
    const result = parseEnvContent("KEY='hello world'");
    expect(result.entries[0].value).toBe("hello world");
  });

  it("treats KEY= as empty value", () => {
    const result = parseEnvContent("KEY=");
    expect(result.entries[0]).toMatchObject({ key: "KEY", value: "" });
  });

  it("handles spaces around =", () => {
    const result = parseEnvContent("KEY = value");
    expect(result.entries[0]).toMatchObject({ key: "KEY", value: "value" });
  });

  it("strips inline comments from unquoted values", () => {
    const result = parseEnvContent("KEY=value # a comment");
    expect(result.entries[0].value).toBe("value");
  });

  it("preserves # inside quoted values", () => {
    const result = parseEnvContent('KEY="value # not a comment"');
    expect(result.entries[0].value).toBe("value # not a comment");
  });

  it("warns on lines with no = sign that look like keys", () => {
    const result = parseEnvContent("MY_VAR");
    expect(result.entries).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain("no \"=\" sign");
  });

  it("warns on unparseable lines", () => {
    const result = parseEnvContent("this is not valid env");
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].message).toContain("Could not parse");
  });

  it("handles values with = in them", () => {
    const result = parseEnvContent("KEY=abc=def");
    expect(result.entries[0].value).toBe("abc=def");
  });

  it("tracks line numbers correctly", () => {
    const result = parseEnvContent("# comment\n\nFOO=1\nBAR=2");
    expect(result.entries[0].line).toBe(3);
    expect(result.entries[1].line).toBe(4);
  });

  it("handles Windows-style line endings", () => {
    const result = parseEnvContent("FOO=bar\r\nBAZ=qux\r\n");
    expect(result.entries).toHaveLength(2);
  });
});
