import pc from "picocolors";
import { loadConfig } from "../../config/index.js";
import { readFileOrNull } from "../../utils/index.js";
import { parseEnvContent } from "../../parser/index.js";
import {
  applyFixes,
  planFixes,
  type FixerOptions,
  type PlaceholderPolicy,
  type PlannedFix,
} from "../../fixer/index.js";
import { scanSources } from "../../scanner/index.js";
import {
  buildJsonEnvelope,
  serializeEnvelope,
  type SchemaAction,
  type SchemaIssue,
} from "../../output/index.js";
import { EXIT_OK, EXIT_ISSUES, EXIT_ERROR } from "../../types.js";
import type { CommandOptions } from "../options.js";

export interface FixCommandOptions extends CommandOptions {
  apply?: boolean;
  yes?: boolean;
  removeUnused?: boolean;
  fromScan?: boolean;
  forceOverwrite?: boolean;
  noBackup?: boolean;
  placeholderPolicy?: string;
}

const VALID_POLICIES: PlaceholderPolicy[] = ["empty", "example", "todo"];

export function fixCommand(cwd: string, opts: FixCommandOptions = {}): number {
  // Validate placeholder policy
  if (
    opts.placeholderPolicy !== undefined &&
    !VALID_POLICIES.includes(opts.placeholderPolicy as PlaceholderPolicy)
  ) {
    emitError(
      opts,
      `--placeholder-policy must be one of: ${VALID_POLICIES.join(", ")}. Got "${opts.placeholderPolicy}".`,
      cwd,
    );
    return EXIT_ERROR;
  }

  let config = null;
  try {
    config = loadConfig(cwd, opts.config);
  } catch (err) {
    emitError(opts, (err as Error).message, cwd);
    return EXIT_ERROR;
  }

  // Make sure there's either an .env or .env.example to work with
  const exampleFile = opts.exampleFile ?? ".env.example";
  const envFile = opts.envFile ?? ".env";
  const exampleContent = readFileOrNull(cwd, exampleFile);

  if (exampleContent === null && !opts.fromScan) {
    emitError(
      opts,
      `Could not find ${exampleFile}. Create one, or use --from-scan to drive fixes from source code.`,
      cwd,
    );
    return EXIT_ERROR;
  }

  // Optionally run scanner
  let scan;
  if (opts.fromScan) {
    const contract = new Set<string>();
    if (exampleContent) {
      for (const e of parseEnvContent(exampleContent).entries) {
        contract.add(e.key);
      }
    }
    const envContent = readFileOrNull(cwd, envFile);
    if (envContent) {
      for (const e of parseEnvContent(envContent).entries) {
        contract.add(e.key);
      }
    }
    scan = scanSources({ root: cwd, contractKeys: contract });
  }

  const fixerOptions: FixerOptions = {
    apply: opts.apply,
    yes: opts.yes,
    removeUnused: opts.removeUnused,
    fromScan: opts.fromScan,
    forceOverwrite: opts.forceOverwrite,
    noBackup: opts.noBackup,
    placeholderPolicy:
      (opts.placeholderPolicy as PlaceholderPolicy | undefined) ?? "todo",
    envFile,
    exampleFile,
  };

  const plan = planFixes({ cwd, config, scan, options: fixerOptions });

  const actions: SchemaAction[] = [];
  const issues: SchemaIssue[] = [];

  // If not applying, emit actions as unapplied and return.
  let applyResult;
  if (opts.apply) {
    applyResult = applyFixes(
      { cwd, config, scan, options: fixerOptions },
      plan,
    );

    if (applyResult.backupPath) {
      actions.push({
        type: "backup",
        target: applyResult.backupPath,
        description: `Backed up ${envFile} before mutation`,
        applied: true,
      });
    }

    for (const fix of applyResult.applied) {
      actions.push(fixToAction(fix, envFile, true));
      issues.push({
        code: "FIX_APPLIED",
        kind: "parse_warning",
        severity: "info",
        key: fix.key,
        message: fix.description,
      });
    }
    for (const { fix, reason } of applyResult.skipped) {
      actions.push({
        ...fixToAction(fix, envFile, false),
        description: `${fix.description} (skipped: ${reason})`,
      });
      issues.push({
        code: "FIX_SKIPPED",
        kind: "parse_warning",
        severity: "warning",
        key: fix.key,
        message: `Skipped: ${fix.description} (${reason})`,
      });
    }
  } else {
    for (const fix of plan.fixes) {
      actions.push(fixToAction(fix, envFile, false));
    }
  }

  // Compute exit code
  let exitCode: number = EXIT_OK;
  if (plan.unresolved.length > 0) exitCode = EXIT_ISSUES;
  if (
    applyResult &&
    applyResult.skipped.length > 0 &&
    opts.failOnWarning
  ) {
    exitCode = EXIT_ISSUES;
  }

  if (opts.json) {
    const envelope = buildJsonEnvelope({
      command: "fix",
      root: cwd,
      issues,
      actions,
      exitCode,
      data: {
        mode: opts.apply ? "apply" : "dry-run",
        placeholderPolicy: fixerOptions.placeholderPolicy,
        plan: plan.fixes,
        unresolved: plan.unresolved,
        applied: applyResult?.applied ?? [],
        skipped: applyResult?.skipped ?? [],
        backupPath: applyResult?.backupPath,
      },
    });
    console.log(serializeEnvelope(envelope));
    return exitCode;
  }

  renderHuman(plan, applyResult, opts);
  return exitCode;
}

function fixToAction(
  fix: PlannedFix,
  envFile: string,
  applied: boolean,
): SchemaAction {
  let type: SchemaAction["type"] = "update";
  if (fix.kind === "add-missing" || fix.kind === "add-from-scan") type = "add";
  if (fix.kind === "remove-extra") type = "remove";

  return {
    type,
    target: envFile,
    description: fix.description,
    applied,
    before: fix.before,
    after: fix.after,
    meta: { kind: fix.kind, key: fix.key, line: fix.line },
  };
}

function renderHuman(
  plan: { fixes: PlannedFix[]; unresolved: string[] },
  applyResult:
    | {
        applied: PlannedFix[];
        skipped: { fix: PlannedFix; reason: string }[];
        backupPath?: string;
      }
    | undefined,
  opts: FixCommandOptions,
): void {
  const lines: string[] = [];
  lines.push("");

  if (plan.fixes.length === 0) {
    lines.push(pc.green("\u2714 Nothing to fix."));
    lines.push("");
    console.log(lines.join("\n"));
    return;
  }

  if (!opts.apply) {
    lines.push(pc.bold(`Dry run — ${plan.fixes.length} fix(es) planned:`));
    lines.push(pc.dim("  Run with --apply to write changes."));
    lines.push("");
    for (const fix of plan.fixes) {
      renderFixPreview(lines, fix);
    }
  } else if (applyResult) {
    if (applyResult.backupPath) {
      lines.push(pc.dim(`Backup: ${applyResult.backupPath}`));
      lines.push("");
    }
    if (applyResult.applied.length > 0) {
      lines.push(pc.green(`\u2714 Applied ${applyResult.applied.length} fix(es):`));
      for (const fix of applyResult.applied) {
        renderFixPreview(lines, fix);
      }
    }
    if (applyResult.skipped.length > 0) {
      lines.push("");
      lines.push(pc.yellow(`\u26A0 Skipped ${applyResult.skipped.length} fix(es):`));
      for (const { fix, reason } of applyResult.skipped) {
        lines.push(`  ${pc.dim("\u2500")} ${fix.description} ${pc.dim(`(${reason})`)}`);
      }
    }
  }

  if (plan.unresolved.length > 0) {
    lines.push("");
    lines.push(
      pc.yellow(
        `\u26A0 ${plan.unresolved.length} required key(s) still empty: ${plan.unresolved.join(", ")}`,
      ),
    );
    lines.push(pc.dim("  Fill these in manually."));
  }

  lines.push("");
  console.log(lines.join("\n"));
}

function renderFixPreview(lines: string[], fix: PlannedFix): void {
  lines.push(`  ${pc.dim("\u2500")} ${pc.bold(fix.description)}`);
  if (fix.before) lines.push(`    ${pc.red("- " + fix.before)}`);
  if (fix.after) lines.push(`    ${pc.green("+ " + fix.after)}`);
}

function emitError(
  opts: FixCommandOptions,
  message: string,
  cwd: string,
): void {
  if (opts.json) {
    const envelope = buildJsonEnvelope({
      command: "fix",
      root: cwd,
      issues: [
        {
          code: "PARSE_WARNING",
          kind: "parse_warning",
          severity: "error",
          key: "",
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
