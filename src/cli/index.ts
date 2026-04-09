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
import type { CommandOptions } from "./options.js";

const program = new Command();

program
  .name("env-doctor")
  .description("Diagnose .env issues in seconds")
  .version("0.2.0");

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

program.parse();
