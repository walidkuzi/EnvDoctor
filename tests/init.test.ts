import { describe, it, expect } from "vitest";
import { generateConfig } from "../src/core/init.js";
import { parseEnvContent } from "../src/parser/env.js";

function run(content: string) {
  return generateConfig(parseEnvContent(content).entries);
}

describe("generateConfig", () => {
  it("infers port type for PORT", () => {
    const { config } = run("PORT=3000");
    expect(config.types?.PORT).toBe("port");
  });

  it("infers boolean type", () => {
    const { config } = run("DEBUG=false");
    expect(config.types?.DEBUG).toBe("boolean");
  });

  it("infers url type", () => {
    const { config } = run("API_URL=https://example.com");
    expect(config.types?.API_URL).toBe("url");
  });

  it("infers enum for NODE_ENV", () => {
    const { config } = run("NODE_ENV=development");
    expect(config.types?.NODE_ENV).toBeDefined();
    const nodeEnv = config.types!.NODE_ENV;
    expect(typeof nodeEnv).toBe("object");
    if (typeof nodeEnv === "object") {
      expect(nodeEnv.type).toBe("enum");
      expect(nodeEnv.values).toContain("development");
    }
  });

  it("does not add type for plain strings", () => {
    const { config } = run("APP_NAME=my-app");
    expect(config.types?.APP_NAME).toBeUndefined();
  });

  it("marks secret-like keys as required", () => {
    const { config } = run("JWT_SECRET=xxx\nAPI_KEY=yyy");
    expect(config.required).toContain("JWT_SECRET");
    expect(config.required).toContain("API_KEY");
  });

  it("does not mark non-secret keys as required", () => {
    const { config } = run("PORT=3000\nDEBUG=false");
    expect(config.required ?? []).toHaveLength(0);
  });

  it("includes default dangerousValues", () => {
    const { config } = run("FOO=bar");
    expect(config.dangerousValues).toBeDefined();
    expect(config.dangerousValues!.length).toBeGreaterThan(0);
  });

  it("returns correct stats", () => {
    const { stats } = run("PORT=3000\nDEBUG=false\nNODE_ENV=development\nAPP_NAME=myapp");
    expect(stats.total).toBe(4);
    expect(stats.typed).toBe(3); // port, boolean, enum
    expect(stats.enums).toBe(1);
  });
});
