import { parseEnvContent } from "../../parser/index.js";
import { analyze } from "../../core/index.js";
import { loadConfig } from "../../config/index.js";
import { renderCIAnalysis } from "../../reporter/index.js";
import { readFileOrNull } from "../../utils/index.js";
import { EXIT_OK, EXIT_ISSUES, EXIT_ERROR } from "../../types.js";

export function ciCommand(cwd: string): number {
  const exampleContent = readFileOrNull(cwd, ".env.example");
  if (exampleContent === null) {
    console.error("[ERROR] .env.example not found");
    return EXIT_ERROR;
  }

  const envContent = readFileOrNull(cwd, ".env");
  if (envContent === null) {
    console.error("[ERROR] .env not found");
    return EXIT_ERROR;
  }

  let config = null;
  try {
    config = loadConfig(cwd);
  } catch (err) {
    console.error(`[ERROR] ${(err as Error).message}`);
    return EXIT_ERROR;
  }

  const example = parseEnvContent(exampleContent);
  const env = parseEnvContent(envContent);
  const result = analyze({ env, example, config });

  console.log(renderCIAnalysis(result));

  return result.summary.errors > 0 ? EXIT_ISSUES : EXIT_OK;
}
