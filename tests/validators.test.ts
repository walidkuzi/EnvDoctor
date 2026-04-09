import { describe, it, expect } from "vitest";
import {
  validateNumber,
  validateBoolean,
  validateUrl,
  validateType,
  inferType,
} from "../src/validators/index.js";

describe("validateNumber", () => {
  it("accepts integers", () => {
    expect(validateNumber("3000")).toBe(true);
    expect(validateNumber("0")).toBe(true);
    expect(validateNumber("-1")).toBe(true);
  });

  it("accepts floats", () => {
    expect(validateNumber("3.14")).toBe(true);
    expect(validateNumber("0.5")).toBe(true);
  });

  it("rejects non-numbers", () => {
    expect(validateNumber("abc")).toBe(false);
    expect(validateNumber("")).toBe(false);
    expect(validateNumber("12abc")).toBe(false);
  });
});

describe("validateBoolean", () => {
  it("accepts true/false", () => {
    expect(validateBoolean("true")).toBe(true);
    expect(validateBoolean("false")).toBe(true);
    expect(validateBoolean("TRUE")).toBe(true);
    expect(validateBoolean("False")).toBe(true);
  });

  it("accepts 1/0", () => {
    expect(validateBoolean("1")).toBe(true);
    expect(validateBoolean("0")).toBe(true);
  });

  it("accepts yes/no", () => {
    expect(validateBoolean("yes")).toBe(true);
    expect(validateBoolean("no")).toBe(true);
  });

  it("rejects non-booleans", () => {
    expect(validateBoolean("maybe")).toBe(false);
    expect(validateBoolean("2")).toBe(false);
    expect(validateBoolean("")).toBe(false);
  });
});

describe("validateUrl", () => {
  it("accepts http URLs", () => {
    expect(validateUrl("http://example.com")).toBe(true);
    expect(validateUrl("https://example.com")).toBe(true);
    expect(validateUrl("https://example.com/path?q=1")).toBe(true);
  });

  it("accepts localhost URLs", () => {
    expect(validateUrl("http://localhost:3000")).toBe(true);
  });

  it("rejects non-URLs", () => {
    expect(validateUrl("not-a-url")).toBe(false);
    expect(validateUrl("")).toBe(false);
    expect(validateUrl("ftp://files.example.com")).toBe(false);
  });
});

describe("validateType", () => {
  it("validates string as non-empty", () => {
    expect(validateType("hello", "string")).toBe(true);
    expect(validateType("", "string")).toBe(false);
  });

  it("delegates to specific validators", () => {
    expect(validateType("42", "number")).toBe(true);
    expect(validateType("true", "boolean")).toBe(true);
    expect(validateType("https://x.com", "url")).toBe(true);
  });
});

describe("inferType", () => {
  it("infers boolean", () => {
    expect(inferType("true")).toBe("boolean");
    expect(inferType("false")).toBe("boolean");
  });

  it("infers number", () => {
    expect(inferType("3000")).toBe("number");
    expect(inferType("3.14")).toBe("number");
  });

  it("infers url", () => {
    expect(inferType("https://example.com")).toBe("url");
    expect(inferType("http://localhost:3000")).toBe("url");
  });

  it("defaults to string", () => {
    expect(inferType("my-app")).toBe("string");
    expect(inferType("some value")).toBe("string");
  });
});
