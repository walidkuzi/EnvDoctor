import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import pc from "picocolors";
import { parseEnvContent } from "../../parser/index.js";
import { generateConfig } from "../../core/init.js";
import { readFileOrNull } from "../../utils/index.js";
import { EXIT_OK, EXIT_ERROR } from "../../types.js";

interface InitOptions {
  yes?: boolean;
}

export function initCommand(cwd: string, opts: InitOptions = {}): number {
  const configPath = resolve(cwd, "env-doctor.json");

  // Check if config already exists
  if (existsSync(configPath) && !opts.yes) {
    console.error(
      pc.yellow("env-doctor.json already exists.\n") +
        "Use --yes to overwrite it.",
    );
    return EXIT_ERROR;
  }

  // Read .env.example
  const exampleContent = readFileOrNull(cwd, ".env.example");
  if (exampleContent === null) {
    console.error(
      "Could not find .env.example in the current directory.\n" +
        "Create a .env.example file first, then run init again.",
    );
    return EXIT_ERROR;
  }

  const parsed = parseEnvContent(exampleContent);

  if (parsed.entries.length === 0) {
    console.error(
      ".env.example is empty or contains no variables.\n" +
        "Add some variables to .env.example first.",
    );
    return EXIT_ERROR;
  }

  const { config, stats } = generateConfig(parsed.entries);

  // Write config
  const json = JSON.stringify(config, null, 2) + "\n";
  writeFileSync(configPath, json, "utf-8");

  // Report
  console.log("");
  console.log(pc.green("\u2714 Generated env-doctor.json"));
  console.log("");
  console.log(`  Detected ${pc.bold(String(stats.total))} variables from .env.example`);
  if (stats.typed > 0) {
    console.log(`  Inferred ${pc.bold(String(stats.typed))} typed variables (${stats.enums > 0 ? `${stats.enums} enum${stats.enums !== 1 ? "s" : ""}, ` : ""}${stats.typed - stats.enums} other${stats.typed - stats.enums !== 1 ? "s" : ""})`);
  }
  if (stats.required > 0) {
    console.log(`  Marked ${pc.bold(String(stats.required))} variables as required`);
  }
  console.log("");
  console.log(pc.dim("  Review env-doctor.json and adjust as needed."));
  console.log(pc.dim("  Then run: env-doctor check"));
  console.log("");

  return EXIT_OK;
}
