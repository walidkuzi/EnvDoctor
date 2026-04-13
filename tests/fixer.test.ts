import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  planFixes,
  applyFixes,
  normalizeBoolean,
  placeholderValue,
  TODO_PLACEHOLDER,
} from "../src/fixer/index.js";

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "env-doctor-fix-"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function write(name: string, content: string): void {
  writeFileSync(join(workDir, name), content, "utf-8");
}

function read(name: string): string {
  return readFileSync(join(workDir, name), "utf-8");
}

describe("normalizeBoolean", () => {
  it("normalizes truthy variants", () => {
    expect(normalizeBoolean("yes")).toBe("true");
    expect(normalizeBoolean("Y")).toBe("true");
    expect(normalizeBoolean("1")).toBe("true");
    expect(normalizeBoolean("TRUE")).toBe("true");
    expect(normalizeBoolean("on")).toBe("true");
  });

  it("normalizes falsy variants", () => {
    expect(normalizeBoolean("no")).toBe("false");
    expect(normalizeBoolean("0")).toBe("false");
    expect(normalizeBoolean("FALSE")).toBe("false");
    expect(normalizeBoolean("off")).toBe("false");
  });

  it("returns null for unrecognized values", () => {
    expect(normalizeBoolean("maybe")).toBe(null);
    expect(normalizeBoolean("")).toBe(null);
  });
});

describe("placeholderValue", () => {
  it("todo policy returns the TODO marker", () => {
    expect(placeholderValue("hello", "todo")).toBe(TODO_PLACEHOLDER);
  });
  it("empty policy returns empty string", () => {
    expect(placeholderValue("hello", "empty")).toBe("");
  });
  it("example policy returns the example value", () => {
    expect(placeholderValue("hello", "example")).toBe("hello");
    expect(placeholderValue(undefined, "example")).toBe("");
  });
});

describe("planFixes", () => {
  it("plans to add missing keys from .env.example", () => {
    write(".env.example", "FOO=bar\nBAZ=qux\n");
    write(".env", "FOO=myfoo\n");

    const plan = planFixes({
      cwd: workDir,
      config: null,
      options: {},
    });
    expect(plan.fixes.some((f) => f.kind === "add-missing" && f.key === "BAZ")).toBe(
      true,
    );
  });

  it("respects placeholder-policy=example", () => {
    write(".env.example", "FOO=bar\nBAZ=hello\n");
    write(".env", "FOO=myfoo\n");

    const plan = planFixes({
      cwd: workDir,
      config: null,
      options: { placeholderPolicy: "example" },
    });
    const addBaz = plan.fixes.find((f) => f.key === "BAZ");
    expect(addBaz?.after).toBe("BAZ=hello");
  });

  it("respects placeholder-policy=empty", () => {
    write(".env.example", "FOO=bar\n");
    write(".env", "");

    const plan = planFixes({
      cwd: workDir,
      config: null,
      options: { placeholderPolicy: "empty" },
    });
    const addFoo = plan.fixes.find((f) => f.key === "FOO");
    expect(addFoo?.after).toBe("FOO=");
  });

  it("plans to normalize boolean values", () => {
    write(".env.example", "DEBUG=false\n");
    write(".env", "DEBUG=yes\n");

    const plan = planFixes({
      cwd: workDir,
      config: null,
      options: {},
    });
    const norm = plan.fixes.find((f) => f.kind === "normalize-boolean");
    expect(norm).toBeDefined();
    expect(norm?.after).toBe("DEBUG=true");
  });

  it("marks placeholder-replacement as risky when value is non-empty", () => {
    write(".env.example", "JWT_SECRET=your_secret_here\n");
    write(".env", "JWT_SECRET=changeme\n");

    const plan = planFixes({
      cwd: workDir,
      config: null,
      options: {},
    });
    const replace = plan.fixes.find((f) => f.kind === "replace-placeholder");
    expect(replace).toBeDefined();
    expect(replace?.risky).toBe(true);
  });

  it("remove-unused is guarded behind the flag", () => {
    write(".env.example", "FOO=1\n");
    write(".env", "FOO=1\nEXTRA=leftover\n");

    const without = planFixes({ cwd: workDir, config: null, options: {} });
    expect(
      without.fixes.some((f) => f.kind === "remove-extra"),
    ).toBe(false);

    const withFlag = planFixes({
      cwd: workDir,
      config: null,
      options: { removeUnused: true },
    });
    expect(
      withFlag.fixes.some(
        (f) => f.kind === "remove-extra" && f.key === "EXTRA",
      ),
    ).toBe(true);
  });

  it("tracks unresolved required keys when value is still empty", () => {
    write(".env.example", "REQUIRED_KEY=something\n");
    write(".env", "REQUIRED_KEY=\n");

    const plan = planFixes({
      cwd: workDir,
      config: null,
      options: {},
    });
    expect(plan.unresolved).toContain("REQUIRED_KEY");
  });
});

describe("applyFixes", () => {
  it("writes adds to the .env file", () => {
    write(".env.example", "FOO=bar\nBAZ=qux\n");
    write(".env", "FOO=1\n");

    const input = { cwd: workDir, config: null, options: { apply: true } };
    const plan = planFixes(input);
    const result = applyFixes(input, plan);

    expect(result.applied.some((f) => f.key === "BAZ")).toBe(true);
    const content = read(".env");
    expect(content).toContain("BAZ=__REPLACE_ME__");
  });

  it("creates a backup by default", () => {
    write(".env.example", "FOO=1\nBAR=2\n");
    write(".env", "FOO=1\n");

    const input = { cwd: workDir, config: null, options: { apply: true } };
    const plan = planFixes(input);
    const result = applyFixes(input, plan);

    expect(result.backupPath).toBeDefined();
    expect(existsSync(result.backupPath!)).toBe(true);
    const backupContent = readFileSync(result.backupPath!, "utf-8");
    expect(backupContent).toBe("FOO=1\n");
  });

  it("skips backup when --no-backup", () => {
    write(".env.example", "FOO=1\nBAR=2\n");
    write(".env", "FOO=1\n");

    const input = {
      cwd: workDir,
      config: null,
      options: { apply: true, noBackup: true },
    };
    const plan = planFixes(input);
    const result = applyFixes(input, plan);

    expect(result.backupPath).toBeUndefined();
    const files = readdirSync(workDir).filter((f) => f.startsWith(".env.bak"));
    expect(files).toHaveLength(0);
  });

  it("skips placeholder overwrite unless --force-overwrite", () => {
    write(".env.example", "JWT_SECRET=your_secret_here\n");
    write(".env", "JWT_SECRET=changeme\n");

    const input = { cwd: workDir, config: null, options: { apply: true } };
    const plan = planFixes(input);
    const result = applyFixes(input, plan);

    const contentAfter = read(".env");
    // changeme should still be there because we didn't force
    expect(contentAfter).toContain("changeme");
    expect(
      result.skipped.some(
        (s) => s.fix.kind === "replace-placeholder" && s.fix.key === "JWT_SECRET",
      ),
    ).toBe(true);
  });

  it("overwrites placeholder when --force-overwrite", () => {
    write(".env.example", "JWT_SECRET=your_secret_here\n");
    write(".env", "JWT_SECRET=changeme\n");

    const input = {
      cwd: workDir,
      config: null,
      options: { apply: true, forceOverwrite: true },
    };
    const plan = planFixes(input);
    applyFixes(input, plan);

    const content = read(".env");
    expect(content).not.toContain("changeme");
    expect(content).toContain("JWT_SECRET=__REPLACE_ME__");
  });

  it("removes extras when --remove-unused is applied", () => {
    write(".env.example", "FOO=1\n");
    write(".env", "FOO=1\nEXTRA=bye\n");

    const input = {
      cwd: workDir,
      config: null,
      options: { apply: true, removeUnused: true },
    };
    const plan = planFixes(input);
    applyFixes(input, plan);

    const content = read(".env");
    expect(content).not.toContain("EXTRA");
    expect(content).toContain("FOO=1");
  });
});
