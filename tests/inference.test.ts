import { describe, it, expect } from "vitest";
import {
  inferVariable,
  inferTypeFromValue,
  inferTypeFromName,
  getKnownEnumValues,
} from "../src/inference/index.js";

describe("inferTypeFromValue", () => {
  it("infers boolean from true/false", () => {
    expect(inferTypeFromValue("true").type).toBe("boolean");
    expect(inferTypeFromValue("false").type).toBe("boolean");
    expect(inferTypeFromValue("yes").type).toBe("boolean");
  });

  it("infers number from numeric strings", () => {
    expect(inferTypeFromValue("3000").type).toBe("number");
    expect(inferTypeFromValue("42").type).toBe("number");
    expect(inferTypeFromValue("3.14").type).toBe("number");
  });

  it("infers url from http/https strings", () => {
    expect(inferTypeFromValue("https://example.com").type).toBe("url");
    expect(inferTypeFromValue("http://localhost:3000").type).toBe("url");
  });

  it("infers email from email-like strings", () => {
    expect(inferTypeFromValue("user@example.com").type).toBe("email");
  });

  it("returns string for unrecognized values", () => {
    expect(inferTypeFromValue("my-app").type).toBe("string");
    expect(inferTypeFromValue("hello world").type).toBe("string");
  });
});

describe("inferTypeFromName", () => {
  it("infers port for PORT-like names", () => {
    expect(inferTypeFromName("PORT")?.type).toBe("port");
    expect(inferTypeFromName("DB_PORT")?.type).toBe("port");
    expect(inferTypeFromName("REDIS_PORT")?.type).toBe("port");
  });

  it("infers url for URL-like names", () => {
    expect(inferTypeFromName("API_URL")?.type).toBe("url");
    expect(inferTypeFromName("DATABASE_URI")?.type).toBe("url");
    expect(inferTypeFromName("WEBHOOK_ENDPOINT")?.type).toBe("url");
  });

  it("infers boolean for boolean-like names", () => {
    expect(inferTypeFromName("ENABLE_LOGGING")?.type).toBe("boolean");
    expect(inferTypeFromName("IS_PRODUCTION")?.type).toBe("boolean");
    expect(inferTypeFromName("DEBUG")?.type).toBe("boolean");
    expect(inferTypeFromName("VERBOSE")?.type).toBe("boolean");
  });

  it("infers enum for known enum names", () => {
    expect(inferTypeFromName("NODE_ENV")?.type).toBe("enum");
    expect(inferTypeFromName("LOG_LEVEL")?.type).toBe("enum");
  });

  it("returns null for generic names", () => {
    expect(inferTypeFromName("APP_NAME")).toBe(null);
    expect(inferTypeFromName("SOME_VALUE")).toBe(null);
  });
});

describe("inferVariable", () => {
  it("combines name and value inference", () => {
    const result = inferVariable("PORT", "3000", "3000");
    expect(result.type).toBe("port");
    expect(result.confidence).toBe("high");
  });

  it("name-based port wins over value-based number", () => {
    const result = inferVariable("REDIS_PORT", undefined, "6379");
    expect(result.type).toBe("port");
  });

  it("detects NODE_ENV as enum", () => {
    const result = inferVariable("NODE_ENV", "production", "development");
    expect(result.type).toBe("enum");
    expect(result.enumValues).toBeDefined();
    expect(result.enumValues!).toContain("production");
  });

  it("falls back to value inference for unknown names", () => {
    const result = inferVariable("MY_FLAG", "true", "false");
    expect(result.type).toBe("boolean");
  });

  it("returns string when nothing else matches", () => {
    const result = inferVariable("APP_NAME", "my-app", "my-app");
    expect(result.type).toBe("string");
  });
});

describe("getKnownEnumValues", () => {
  it("returns values for NODE_ENV", () => {
    const values = getKnownEnumValues("NODE_ENV");
    expect(values).toBeDefined();
    expect(values).toContain("development");
    expect(values).toContain("production");
  });

  it("returns undefined for unknown keys", () => {
    expect(getKnownEnumValues("RANDOM_VAR")).toBeUndefined();
  });
});
