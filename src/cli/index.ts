#!/usr/bin/env node

import { Command } from "commander";
import pc from "picocolors";
import { checkCommand } from "./commands/check.js";
import { diffCommand } from "./commands/diff.js";
import { validateCommand } from "./commands/validate.js";
import { ciCommand } from "./commands/ci.js";
import { initCommand } from "./commands/init.js";
import { explainCommand } from "./commands/explain.js";
import { matrixCommand } from "./commands/matrix.js";
import { scanCommand } from "./commands/scan.js";
import { fixCommand } from "./commands/fix.js";
import { hooksInstallCommand } from "./commands/hooks.js";
import { TOOL_VERSION } from "../output/schema.js";
import type { CommandOptions } from "./options.js";

const program = new Command();

program
  .name("env-doctor")
  .description("Diagnose .env issues in seconds — scan code, fix issues, install hooks")
  .version(TOOL_VERSION);

// --- Shared options ---

function addCommonOptions(cmd: Command): Command {
  return cmd
    .option("--json", "Output results as JSON")
    .option("--quiet", "Suppress detailed output, show only summary")
    .option("--fail-on-warning", "Exit with code 1 on warnings too")
    .option("--no-color", "Disable colored output")
    .option("--config <path>", "Path to env-doctor.json config file")
    .option("--env-file <path>", "Path to .env file (default: .env)")
    .option("--example-file <path>", "Path to .env.example file (default: .env.example)");
}

function resolveOpts(raw: Record<string, unknown>): CommandOptions {
  return {
    json: raw.json as boolean | undefined,
    quiet: raw.quiet as boolean | undefined,
    failOnWarning: raw.failOnWarning as boolean | undefined,
    config: raw.config as string | undefined,
    envFile: raw.envFile as string | undefined,
    exampleFile: raw.exampleFile as string | undefined,
  };
}

function handleNoColor(raw: Record<string, unknown>): void {
  // Commander's --no-color sets color=false
  if (raw.color === false || process.env.NO_COLOR) {
    pc.createColors(false);
  }
}

// --- Commands ---

addCommonOptions(
  program
    .command("check")
    .description("Check .env against .env.example and report all issues"),
).action((raw) => {
  handleNoColor(raw);
  const code = checkCommand(process.cwd(), resolveOpts(raw));
  process.exit(code);
});

addCommonOptions(
  program
    .command("diff")
    .description("Compare keys between .env and .env.example"),
).action((raw) => {
  handleNoColor(raw);
  const code = diffCommand(process.cwd(), resolveOpts(raw));
  process.exit(code);
});

addCommonOptions(
  program
    .command("validate")
    .description("Validate .env values against expected types"),
).action((raw) => {
  handleNoColor(raw);
  const code = validateCommand(process.cwd(), resolveOpts(raw));
  process.exit(code);
});

addCommonOptions(
  program
    .command("ci")
    .description("Run checks with concise CI-friendly output"),
).action((raw) => {
  handleNoColor(raw);
  const code = ciCommand(process.cwd(), resolveOpts(raw));
  process.exit(code);
});

program
  .command("init")
  .description("Generate env-doctor.json from .env.example")
  .option("--yes", "Overwrite existing config without asking")
  .action((raw) => {
    const code = initCommand(process.cwd(), { yes: raw.yes });
    process.exit(code);
  });

addCommonOptions(
  program
    .command("explain <variable>")
    .description("Explain a single environment variable"),
).action((variable: string, raw) => {
  handleNoColor(raw);
  const code = explainCommand(process.cwd(), variable, resolveOpts(raw));
  process.exit(code);
});

addCommonOptions(
  program
    .command("matrix")
    .description("Compare variables across all environment files"),
).action((raw) => {
  handleNoColor(raw);
  const code = matrixCommand(process.cwd(), resolveOpts(raw));
  process.exit(code);
});

// --- scan ---
addCommonOptions(
  program
    .command("scan")
    .description("Scan source code for env usage and compare with your contract")
    .option("--paths <paths>", "Comma-separated source paths to scan")
    .option("--include <globs>", "Comma-separated include patterns")
    .option("--exclude <globs>", "Comma-separated exclude patterns")
    .option("--min-typo-score <score>", "Minimum similarity (0-1) for typo detection", "0.82"),
).action((raw) => {
  handleNoColor(raw);
  const code = scanCommand(process.cwd(), {
    ...resolveOpts(raw),
    paths: raw.paths as string | undefined,
    include: raw.include as string | undefined,
    exclude: raw.exclude as string | undefined,
    minTypoScore: raw.minTypoScore as string | undefined,
  });
  process.exit(code);
});

// --- fix ---
addCommonOptions(
  program
    .command("fix")
    .description("Apply safe, guided fixes to your .env file (dry run by default)")
    .option("--apply", "Actually write changes (default is dry run)")
    .option("--yes", "Skip interactive confirmations")
    .option("--remove-unused", "Remove keys present in .env but not in .env.example")
    .option("--from-scan", "Use scan results to drive fixes (adds used-but-undefined keys)")
    .option("--force-overwrite", "Allow overwriting non-empty values")
    .option("--no-backup", "Skip creating a backup of .env before mutation")
    .option(
      "--placeholder-policy <policy>",
      "How to fill in placeholder values: empty | example | todo",
      "todo",
    ),
).action((raw) => {
  handleNoColor(raw);
  const code = fixCommand(process.cwd(), {
    ...resolveOpts(raw),
    apply: raw.apply as boolean | undefined,
    yes: raw.yes as boolean | undefined,
    removeUnused: raw.removeUnused as boolean | undefined,
    fromScan: raw.fromScan as boolean | undefined,
    forceOverwrite: raw.forceOverwrite as boolean | undefined,
    noBackup: raw.backup === false,
    placeholderPolicy: raw.placeholderPolicy as string | undefined,
  });
  process.exit(code);
});

// --- hooks install ---
const hooksCmd = program
  .command("hooks")
  .description("Manage git hook integrations for env-doctor");

addCommonOptions(
  hooksCmd
    .command("install")
    .description("Install an env-doctor git hook (pre-commit / pre-push)")
    .option(
      "--tool <tool>",
      "Hook tool: auto | husky | simple-git-hooks | lefthook",
      "auto",
    )
    .option(
      "--stage <stage>",
      "Hook stage: pre-commit | pre-push | both",
      "pre-commit",
    )
    .option("--command <cmd>", "Command to run in the hook", "npx env-doctor check")
    .option("--dry-run", "Show planned changes without writing anything")
    .option("--yes", "Skip interactive confirmations"),
).action((raw) => {
  handleNoColor(raw);
  const code = hooksInstallCommand(process.cwd(), {
    ...resolveOpts(raw),
    tool: raw.tool as string | undefined,
    stage: raw.stage as string | undefined,
    command: raw.command as string | undefined,
    dryRun: raw.dryRun as boolean | undefined,
    yes: raw.yes as boolean | undefined,
  });
  process.exit(code);
});

program.parse();
