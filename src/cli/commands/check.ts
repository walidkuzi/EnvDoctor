import { parseEnvContent } from "../../parser/index.js";
import { analyze } from "../../core/index.js";
import { loadConfig } from "../../config/index.js";
import { renderAnalysis } from "../../reporter/index.js";
import { readFileOrNull } from "../../utils/index.js";
import { EXIT_OK, EXIT_ISSUES, EXIT_ERROR } from "../../types.js";

export function checkCommand(cwd: string): number {
  const exampleContent = readFileOrNull(cwd, ".env.example");
  if (exampleContent === null) {
    console.error(
      "Could not find .env.example in the current directory.\n" +
        "This file is used as the reference for expected variables.\n" +
        "Create a .env.example file with your project's required variables.",
    );
    return EXIT_ERROR;
  }

  const envContent = readFileOrNull(cwd, ".env");
  if (envContent === null) {
    console.error(
      "Could not find .env in the current directory.\n" +
        "Copy .env.example to .env and fill in your values:\n\n" +
        "  cp .env.example .env",
    );
    return EXIT_ERROR;
  }

  let config = null;
  try {
    config = loadConfig(cwd);
  } catch (err) {
    console.error((err as Error).message);
    return EXIT_ERROR;
  }

  const example = parseEnvContent(exampleContent);
  const env = parseEnvContent(envContent);
  const result = analyze({ env, example, config });

  console.log(renderAnalysis(result));

  return result.summary.errors > 0 ? EXIT_ISSUES : EXIT_OK;
}
