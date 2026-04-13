import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  planHookInstall,
  applyHookInstall,
} from "../src/hooks/index.js";

let workDir: string;

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "env-doctor-hooks-"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function writePkg(pkg: Record<string, unknown>): void {
  writeFileSync(
    join(workDir, "package.json"),
    JSON.stringify(pkg, null, 2),
    "utf-8",
  );
}

describe("planHookInstall", () => {
  it("errors when package.json is missing", () => {
    const plan = planHookInstall({
      cwd: workDir,
      options: { tool: "auto" },
    });
    expect(plan.tool).toBe("none");
    expect(plan.error).toMatch(/package\.json/);
  });

  it("errors when the requested tool is not installed", () => {
    writePkg({ name: "x", devDependencies: {} });
    const plan = planHookInstall({
      cwd: workDir,
      options: { tool: "husky" },
    });
    expect(plan.tool).toBe("none");
    expect(plan.error).toMatch(/husky/);
    expect(plan.manualInstructions).toBeDefined();
  });

  it("auto-detects husky from devDependencies", () => {
    writePkg({ name: "x", devDependencies: { husky: "^8.0.0" } });
    const plan = planHookInstall({
      cwd: workDir,
      options: { tool: "auto", stage: "pre-commit" },
    });
    expect(plan.tool).toBe("husky");
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].target).toContain(".husky/pre-commit");
    expect(plan.steps[0].after).toContain("npx env-doctor check");
  });

  it("auto-detects simple-git-hooks and plans package.json edit", () => {
    writePkg({ name: "x", devDependencies: { "simple-git-hooks": "^2.9.0" } });
    const plan = planHookInstall({
      cwd: workDir,
      options: { tool: "auto", stage: "pre-commit" },
    });
    expect(plan.tool).toBe("simple-git-hooks");
    expect(plan.steps[0].target).toContain("package.json");
    expect(plan.steps[0].after).toContain("simple-git-hooks");
    expect(plan.steps[0].after).toContain("npx env-doctor check");
  });

  it("simple-git-hooks merges into existing config without clobbering", () => {
    writePkg({
      name: "x",
      devDependencies: { "simple-git-hooks": "^2.9.0" },
      "simple-git-hooks": { "pre-commit": "npm test" },
    });

    const plan = planHookInstall({
      cwd: workDir,
      options: { tool: "simple-git-hooks", stage: "pre-commit" },
    });
    expect(plan.steps[0].after).toContain("npm test");
    expect(plan.steps[0].after).toContain("npx env-doctor check");
    expect(plan.steps[0].after).toContain("&&");
  });

  it("detects when env-doctor is already present (no-op)", () => {
    writePkg({
      name: "x",
      devDependencies: { "simple-git-hooks": "^2.9.0" },
      "simple-git-hooks": { "pre-commit": "npx env-doctor check" },
    });

    const plan = planHookInstall({
      cwd: workDir,
      options: { tool: "simple-git-hooks", stage: "pre-commit" },
    });
    expect(plan.steps[0].description).toMatch(/already contains/);
    expect(plan.steps[0].before).toBeUndefined();
    expect(plan.steps[0].after).toBeUndefined();
  });

  it("honors stage=both (plans pre-commit + pre-push)", () => {
    writePkg({ name: "x", devDependencies: { husky: "^8" } });
    const plan = planHookInstall({
      cwd: workDir,
      options: { tool: "husky", stage: "both" },
    });
    expect(plan.stages).toEqual(["pre-commit", "pre-push"]);
    expect(plan.steps).toHaveLength(2);
  });

  it("lefthook returns clear error with manual instructions", () => {
    writePkg({ name: "x", devDependencies: { lefthook: "^1.0.0" } });
    const plan = planHookInstall({
      cwd: workDir,
      options: { tool: "auto", stage: "pre-commit" },
    });
    expect(plan.tool).toBe("lefthook");
    expect(plan.error).toMatch(/not supported/);
    expect(plan.manualInstructions).toBeDefined();
  });
});

describe("applyHookInstall", () => {
  it("writes the husky hook file", () => {
    writePkg({ name: "x", devDependencies: { husky: "^8" } });
    const input = {
      cwd: workDir,
      options: { tool: "husky" as const, stage: "pre-commit" as const },
    };
    const plan = planHookInstall(input);
    const result = applyHookInstall(input, plan);

    expect(result.appliedSteps).toHaveLength(1);
    const hookPath = join(workDir, ".husky", "pre-commit");
    expect(existsSync(hookPath)).toBe(true);
    expect(readFileSync(hookPath, "utf-8")).toContain("npx env-doctor check");
  });

  it("writes the simple-git-hooks config to package.json", () => {
    writePkg({ name: "x", devDependencies: { "simple-git-hooks": "^2.9.0" } });
    const input = {
      cwd: workDir,
      options: {
        tool: "simple-git-hooks" as const,
        stage: "pre-commit" as const,
      },
    };
    const plan = planHookInstall(input);
    applyHookInstall(input, plan);

    const pkg = JSON.parse(
      readFileSync(join(workDir, "package.json"), "utf-8"),
    );
    expect(pkg["simple-git-hooks"]).toBeDefined();
    expect(pkg["simple-git-hooks"]["pre-commit"]).toBe("npx env-doctor check");
  });

  it("preserves unrelated package.json fields", () => {
    writePkg({
      name: "x",
      version: "1.0.0",
      scripts: { test: "vitest" },
      devDependencies: { "simple-git-hooks": "^2.9.0" },
    });
    const input = {
      cwd: workDir,
      options: {
        tool: "simple-git-hooks" as const,
        stage: "pre-commit" as const,
      },
    };
    const plan = planHookInstall(input);
    applyHookInstall(input, plan);

    const pkg = JSON.parse(
      readFileSync(join(workDir, "package.json"), "utf-8"),
    );
    expect(pkg.name).toBe("x");
    expect(pkg.version).toBe("1.0.0");
    expect(pkg.scripts.test).toBe("vitest");
  });

  it("does nothing when plan has an error", () => {
    writePkg({ name: "x", devDependencies: {} });
    const input = {
      cwd: workDir,
      options: { tool: "husky" as const },
    };
    const plan = planHookInstall(input);
    const result = applyHookInstall(input, plan);
    expect(result.appliedSteps).toHaveLength(0);
  });
});
