import pc from "picocolors";
import {
  applyHookInstall,
  planHookInstall,
  type HookPlan,
  type HookStage,
  type HookTool,
} from "../../hooks/index.js";
import {
  buildJsonEnvelope,
  serializeEnvelope,
  type SchemaAction,
  type SchemaIssue,
} from "../../output/index.js";
import { EXIT_OK, EXIT_ISSUES, EXIT_ERROR } from "../../types.js";
import type { CommandOptions } from "../options.js";

export interface HooksInstallCommandOptions extends CommandOptions {
  tool?: string;
  stage?: string;
  command?: string;
  dryRun?: boolean;
  yes?: boolean;
}

const VALID_TOOLS: HookTool[] = [
  "auto",
  "husky",
  "simple-git-hooks",
  "lefthook",
];
const VALID_STAGES: HookStage[] = ["pre-commit", "pre-push", "both"];

export function hooksInstallCommand(
  cwd: string,
  opts: HooksInstallCommandOptions = {},
): number {
  if (opts.tool && !VALID_TOOLS.includes(opts.tool as HookTool)) {
    emitError(
      opts,
      `--tool must be one of: ${VALID_TOOLS.join(", ")}. Got "${opts.tool}".`,
      cwd,
    );
    return EXIT_ERROR;
  }
  if (opts.stage && !VALID_STAGES.includes(opts.stage as HookStage)) {
    emitError(
      opts,
      `--stage must be one of: ${VALID_STAGES.join(", ")}. Got "${opts.stage}".`,
      cwd,
    );
    return EXIT_ERROR;
  }

  const plan = planHookInstall({
    cwd,
    options: {
      tool: (opts.tool as HookTool | undefined) ?? "auto",
      stage: (opts.stage as HookStage | undefined) ?? "pre-commit",
      command: opts.command,
      dryRun: opts.dryRun,
      yes: opts.yes,
    },
  });

  const actions: SchemaAction[] = [];
  const issues: SchemaIssue[] = [];

  let exitCode: number = EXIT_OK;
  let appliedSteps = plan.steps;

  if (plan.error) {
    issues.push({
      code: "HOOK_UNSUPPORTED_TOOL",
      kind: "parse_warning",
      severity: "error",
      key: "hooks",
      message: plan.error,
      hint: plan.manualInstructions,
    });
    exitCode = EXIT_ERROR;
  } else if (!opts.dryRun) {
    const result = applyHookInstall(
      {
        cwd,
        options: {
          tool: (opts.tool as HookTool | undefined) ?? "auto",
          stage: (opts.stage as HookStage | undefined) ?? "pre-commit",
          command: opts.command,
          dryRun: opts.dryRun,
          yes: opts.yes,
        },
      },
      plan,
    );
    appliedSteps = result.appliedSteps.length > 0 ? result.appliedSteps : plan.steps;

    for (const step of result.appliedSteps) {
      actions.push({
        type: step.target.endsWith("package.json")
          ? "update-package-json"
          : "install-hook",
        target: step.target,
        description: step.description,
        applied: true,
        before: step.before,
        after: step.after,
      });
      issues.push({
        code: "HOOK_INSTALLED",
        kind: "parse_warning",
        severity: "info",
        key: "hooks",
        message: step.description,
      });
    }

    // Steps with no-op (already present) get reported too
    for (const step of plan.steps) {
      if (step.before === step.after && step.after !== undefined) {
        issues.push({
          code: "HOOK_ALREADY_PRESENT",
          kind: "parse_warning",
          severity: "info",
          key: "hooks",
          message: step.description,
        });
      }
    }
  } else {
    // Dry run — report planned but unapplied steps
    for (const step of plan.steps) {
      actions.push({
        type: step.target.endsWith("package.json")
          ? "update-package-json"
          : "install-hook",
        target: step.target,
        description: step.description,
        applied: false,
        before: step.before,
        after: step.after,
      });
    }
  }

  if (opts.json) {
    const envelope = buildJsonEnvelope({
      command: "hooks install",
      root: cwd,
      issues,
      actions,
      exitCode,
      data: {
        tool: plan.tool,
        stages: plan.stages,
        command: plan.command,
        dryRun: !!opts.dryRun,
        manualInstructions: plan.manualInstructions,
      },
    });
    console.log(serializeEnvelope(envelope));
    return exitCode;
  }

  renderHuman(plan, appliedSteps, opts);
  return exitCode;
}

function renderHuman(
  plan: HookPlan,
  steps: HookPlan["steps"],
  opts: HooksInstallCommandOptions,
): void {
  const lines: string[] = [];
  lines.push("");

  if (plan.error) {
    lines.push(pc.red("\u2716 " + plan.error));
    if (plan.manualInstructions) {
      lines.push("");
      lines.push(pc.dim(plan.manualInstructions));
    }
    lines.push("");
    console.log(lines.join("\n"));
    return;
  }

  const toolLabel = plan.tool;
  lines.push(
    pc.bold(`Tool: ${toolLabel}`) +
      pc.dim(`   Stages: ${plan.stages.join(", ")}   Command: ${plan.command}`),
  );
  lines.push("");

  if (steps.length === 0) {
    lines.push(pc.dim("No changes needed."));
    lines.push("");
    console.log(lines.join("\n"));
    return;
  }

  if (opts.dryRun) {
    lines.push(pc.bold("Dry run — planned changes:"));
  } else {
    lines.push(pc.green(`\u2714 Installed env-doctor ${plan.stages.join(", ")} hook`));
  }
  lines.push("");

  for (const step of steps) {
    lines.push(`  ${pc.dim("\u2500")} ${step.description}`);
    lines.push(`    ${pc.dim("target:")} ${step.target}`);
  }

  if (!opts.dryRun) {
    lines.push("");
    lines.push(pc.dim("Done. Run the hook manually to verify it works."));
  }

  lines.push("");
  console.log(lines.join("\n"));
}

function emitError(
  opts: HooksInstallCommandOptions,
  message: string,
  cwd: string,
): void {
  if (opts.json) {
    const envelope = buildJsonEnvelope({
      command: "hooks install",
      root: cwd,
      issues: [
        {
          code: "HOOK_UNSUPPORTED_TOOL",
          kind: "parse_warning",
          severity: "error",
          key: "hooks",
          message,
        },
      ],
      exitCode: EXIT_ERROR,
    });
    console.log(serializeEnvelope(envelope));
  } else {
    console.error(message);
  }
}
