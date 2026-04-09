#!/usr/bin/env node

import { Command } from "commander";
import { checkCommand } from "./commands/check.js";
import { diffCommand } from "./commands/diff.js";
import { validateCommand } from "./commands/validate.js";
import { ciCommand } from "./commands/ci.js";

const program = new Command();

program
  .name("env-doctor")
  .description("Diagnose .env issues in seconds")
  .version("0.1.0");

program
  .command("check")
  .description("Check .env against .env.example and report all issues")
  .action(() => {
    const code = checkCommand(process.cwd());
    process.exit(code);
  });

program
  .command("diff")
  .description("Compare keys between .env and .env.example")
  .action(() => {
    const code = diffCommand(process.cwd());
    process.exit(code);
  });

program
  .command("validate")
  .description("Validate .env values against expected types")
  .action(() => {
    const code = validateCommand(process.cwd());
    process.exit(code);
  });

program
  .command("ci")
  .description("Run checks with concise CI-friendly output")
  .action(() => {
    const code = ciCommand(process.cwd());
    process.exit(code);
  });

program.parse();
