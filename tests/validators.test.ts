import { describe, it, expect } from "vitest";
import {
  validateNumber,
  validateBoolean,
  validateUrl,
  validatePort,
  validateEmail,
  validateType,
} from "../src/validators/index.js";
import { inferTypeFromValue } from "../src/inference/index.js";

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

  it("accepts database URLs", () => {
    expect(validateUrl("postgres://user:pass@localhost:5432/db")).toBe(true);
    expect(validateUrl("redis://localhost:6379")).toBe(true);
    expect(validateUrl("mongodb://localhost:27017/mydb")).toBe(true);
  });

  it("rejects non-URLs", () => {
    expect(validateUrl("not-a-url")).toBe(false);
    expect(validateUrl("")).toBe(false);
    expect(validateUrl("ftp://files.example.com")).toBe(false);
  });
});

describe("validatePort", () => {
  it("accepts valid ports", () => {
    expect(validatePort("80")).toBe(true);
    expect(validatePort("3000")).toBe(true);
    expect(validatePort("8080")).toBe(true);
    expect(validatePort("65535")).toBe(true);
  });

  it("rejects invalid ports", () => {
    expect(validatePort("0")).toBe(false);
    expect(validatePort("65536")).toBe(false);
    expect(validatePort("-1")).toBe(false);
    expect(validatePort("abc")).toBe(false);
    expect(validatePort("3.14")).toBe(false);
  });
});

describe("validateEmail", () => {
  it("accepts valid emails", () => {
    expect(validateEmail("user@example.com")).toBe(true);
    expect(validateEmail("test+tag@mail.co.uk")).toBe(true);
  });

  it("rejects invalid emails", () => {
    expect(validateEmail("not-an-email")).toBe(false);
    expect(validateEmail("@example.com")).toBe(false);
    expect(validateEmail("user@")).toBe(false);
    expect(validateEmail("")).toBe(false);
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
    expect(validateType("3000", "port")).toBe(true);
    expect(validateType("u@e.com", "email")).toBe(true);
  });
});

describe("inferTypeFromValue", () => {
  it("infers boolean", () => {
    expect(inferTypeFromValue("true").type).toBe("boolean");
    expect(inferTypeFromValue("false").type).toBe("boolean");
  });

  it("infers number", () => {
    expect(inferTypeFromValue("3000").type).toBe("number");
    expect(inferTypeFromValue("3.14").type).toBe("number");
  });

  it("infers url", () => {
    expect(inferTypeFromValue("https://example.com").type).toBe("url");
    expect(inferTypeFromValue("http://localhost:3000").type).toBe("url");
  });

  it("defaults to string", () => {
    expect(inferTypeFromValue("my-app").type).toBe("string");
    expect(inferTypeFromValue("some value").type).toBe("string");
  });
});
