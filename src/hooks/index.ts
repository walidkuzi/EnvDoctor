import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type HookTool = "auto" | "husky" | "simple-git-hooks" | "lefthook";
export type HookStage = "pre-commit" | "pre-push" | "both";

export interface HooksInstallOptions {
  tool?: HookTool;
  stage?: HookStage;
  command?: string;
  dryRun?: boolean;
  yes?: boolean;
}

export type ResolvedTool = "husky" | "simple-git-hooks" | "lefthook";

export interface HookPlanStep {
  description: string;
  target: string;
  before?: string;
  after?: string;
  applied: boolean;
}

export interface HookPlan {
  tool: ResolvedTool | "none";
  stages: ("pre-commit" | "pre-push")[];
  command: string;
  steps: HookPlanStep[];
  error?: string;
  manualInstructions?: string;
}

const DEFAULT_COMMAND = "npx env-doctor check";

export interface HookInstallInput {
  cwd: string;
  options: HooksInstallOptions;
}

export interface HookApplyResult {
  plan: HookPlan;
  appliedSteps: HookPlanStep[];
}

export function planHookInstall(input: HookInstallInput): HookPlan {
  const { cwd, options } = input;
  const stage = options.stage ?? "pre-commit";
  const command = options.command ?? DEFAULT_COMMAND;
  const stages: ("pre-commit" | "pre-push")[] =
    stage === "both" ? ["pre-commit", "pre-push"] : [stage];

  const pkgPath = resolve(cwd, "package.json");
  if (!existsSync(pkgPath)) {
    return {
      tool: "none",
      stages,
      command,
      steps: [],
      error: "No package.json found in current directory.",
      manualInstructions:
        "Initialize a package.json (npm init -y) and re-run this command.",
    };
  }

  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  } catch (err) {
    return {
      tool: "none",
      stages,
      command,
      steps: [],
      error: `Could not parse package.json: ${(err as Error).message}`,
      manualInstructions: "Fix package.json and re-run this command.",
    };
  }

  const requestedTool = options.tool ?? "auto";
  const resolved = resolveTool(requestedTool, pkg);

  if (resolved === null) {
    return {
      tool: "none",
      stages,
      command,
      steps: [],
      error: `Requested hook tool "${requestedTool}" is not installed.`,
      manualInstructions: manualFallback(stages, command),
    };
  }

  if (resolved === "lefthook") {
    // v0.3 does not auto-wire lefthook configs — emit manual instructions.
    return {
      tool: "lefthook",
      stages,
      command,
      steps: [],
      error: "lefthook auto-install is not supported in v0.3.",
      manualInstructions: [
        "Add the following to lefthook.yml:",
        "",
        ...stages.map(
          (s) =>
            `${s}:\n  commands:\n    env-doctor:\n      run: ${command}`,
        ),
      ].join("\n"),
    };
  }

  if (resolved === "husky") {
    return planHusky(cwd, stages, command, pkg);
  }

  // simple-git-hooks
  return planSimpleGitHooks(cwd, stages, command, pkg);
}

export function applyHookInstall(
  input: HookInstallInput,
  plan: HookPlan,
): HookApplyResult {
  if (plan.error || plan.tool === "none") {
    return { plan, appliedSteps: [] };
  }

  const appliedSteps: HookPlanStep[] = [];

  for (const step of plan.steps) {
    if (step.after === undefined) continue;
    const target = step.target;
    // Ensure directory exists
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, step.after, "utf-8");

    // If husky hook file, make executable
    if (target.includes(".husky/") && process.platform !== "win32") {
      try {
        // chmod via writeFileSync can't set mode — do it manually
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { chmodSync } = require("node:fs");
        chmodSync(target, 0o755);
      } catch {
        // Best effort
      }
    }
    appliedSteps.push({ ...step, applied: true });
  }

  return { plan, appliedSteps };
}

// --- internal helpers ---

function resolveTool(
  requested: HookTool,
  pkg: Record<string, unknown>,
): ResolvedTool | null {
  const deps = {
    ...(pkg.dependencies as Record<string, string> | undefined),
    ...(pkg.devDependencies as Record<string, string> | undefined),
  };
  const hasHusky = "husky" in deps;
  const hasSimple = "simple-git-hooks" in deps;
  const hasLefthook = "lefthook" in deps;

  switch (requested) {
    case "auto":
      if (hasHusky) return "husky";
      if (hasSimple) return "simple-git-hooks";
      if (hasLefthook) return "lefthook";
      return null;
    case "husky":
      return hasHusky ? "husky" : null;
    case "simple-git-hooks":
      return hasSimple ? "simple-git-hooks" : null;
    case "lefthook":
      return hasLefthook ? "lefthook" : null;
  }
}

function planHusky(
  cwd: string,
  stages: ("pre-commit" | "pre-push")[],
  command: string,
  _pkg: Record<string, unknown>,
): HookPlan {
  const steps: HookPlanStep[] = [];

  for (const stage of stages) {
    const hookPath = resolve(cwd, ".husky", stage);
    const existing = existsSync(hookPath) ? readFileSync(hookPath, "utf-8") : null;

    if (existing && existing.includes(command)) {
      steps.push({
        description: `Husky ${stage} hook already contains "${command}"`,
        target: hookPath,
        before: existing,
        after: existing,
        applied: false,
      });
      continue;
    }

    const content = existing
      ? appendToHusky(existing, command)
      : renderHuskyHook(command);

    steps.push({
      description: `Install env-doctor into .husky/${stage}`,
      target: hookPath,
      before: existing ?? undefined,
      after: content,
      applied: false,
    });
  }

  return {
    tool: "husky",
    stages,
    command,
    steps,
  };
}

function renderHuskyHook(command: string): string {
  return `#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"\n\n${command}\n`;
}

function appendToHusky(existing: string, command: string): string {
  const trimmed = existing.endsWith("\n") ? existing : existing + "\n";
  return `${trimmed}${command}\n`;
}

function planSimpleGitHooks(
  cwd: string,
  stages: ("pre-commit" | "pre-push")[],
  command: string,
  pkg: Record<string, unknown>,
): HookPlan {
  const pkgPath = resolve(cwd, "package.json");
  const existingHooks =
    (pkg["simple-git-hooks"] as Record<string, string> | undefined) ?? {};
  const updated = { ...existingHooks };

  const steps: HookPlanStep[] = [];
  let changed = false;

  for (const stage of stages) {
    const current = updated[stage];
    if (current && current.includes(command)) {
      steps.push({
        description: `simple-git-hooks ${stage} already contains "${command}"`,
        target: pkgPath,
        applied: false,
      });
      continue;
    }
    const next = current ? `${current} && ${command}` : command;
    updated[stage] = next;
    changed = true;
    steps.push({
      description: `Add "${command}" to simple-git-hooks.${stage} in package.json`,
      target: pkgPath,
      applied: false,
    });
  }

  // Build the new package.json content when changed
  if (changed) {
    const newPkg = { ...pkg, "simple-git-hooks": updated };
    const newContent = JSON.stringify(newPkg, null, 2) + "\n";
    // All steps that target package.json share the same after-content
    for (const step of steps) {
      if (step.target === pkgPath) {
        step.before = JSON.stringify(pkg, null, 2) + "\n";
        step.after = newContent;
      }
    }
  }

  return {
    tool: "simple-git-hooks",
    stages,
    command,
    steps,
  };
}

function manualFallback(
  stages: ("pre-commit" | "pre-push")[],
  command: string,
): string {
  return [
    "Manual install (pick your tool):",
    "",
    "husky:",
    "  npx husky init",
    ...stages.map((s) => `  echo '${command}' > .husky/${s} && chmod +x .husky/${s}`),
    "",
    "simple-git-hooks (add to package.json):",
    `  "simple-git-hooks": { ${stages.map((s) => `"${s}": "${command}"`).join(", ")} }`,
    "",
    "lefthook (add to lefthook.yml):",
    ...stages.map(
      (s) =>
        `  ${s}:\n    commands:\n      env-doctor:\n        run: ${command}`,
    ),
  ].join("\n");
}
