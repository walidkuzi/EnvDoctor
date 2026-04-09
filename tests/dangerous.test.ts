import { describe, it, expect } from "vitest";
import { checkDangerousValue } from "../src/core/dangerous.js";

describe("checkDangerousValue", () => {
  it("flags known placeholder values", () => {
    expect(checkDangerousValue("ANY_KEY", "changeme").isDangerous).toBe(true);
    expect(checkDangerousValue("ANY_KEY", "password").isDangerous).toBe(true);
    expect(checkDangerousValue("ANY_KEY", "your_key_here").isDangerous).toBe(true);
    expect(checkDangerousValue("ANY_KEY", "replace_me").isDangerous).toBe(true);
  });

  it("flags short secrets for secret-like keys", () => {
    expect(checkDangerousValue("JWT_SECRET", "abc").isDangerous).toBe(true);
    expect(checkDangerousValue("API_KEY", "short").isDangerous).toBe(true);
    expect(checkDangerousValue("AUTH_TOKEN", "x").isDangerous).toBe(true);
  });

  it("does not flag long secrets", () => {
    expect(
      checkDangerousValue("JWT_SECRET", "a1b2c3d4e5f6g7h8i9j0").isDangerous,
    ).toBe(false);
  });

  it("does not flag normal non-secret values", () => {
    expect(checkDangerousValue("APP_NAME", "my-app").isDangerous).toBe(false);
    expect(checkDangerousValue("PORT", "3000").isDangerous).toBe(false);
  });

  it("is case-insensitive for dangerous values", () => {
    expect(checkDangerousValue("KEY", "CHANGEME").isDangerous).toBe(true);
    expect(checkDangerousValue("KEY", "Password").isDangerous).toBe(true);
  });

  it("uses custom dangerous values", () => {
    expect(
      checkDangerousValue("KEY", "my_custom_bad", ["my_custom_bad"]).isDangerous,
    ).toBe(true);
  });
});
