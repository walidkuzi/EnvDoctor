import { parseEnvContent } from "../../parser/index.js";
import { explain } from "../../core/index.js";
import { loadConfig } from "../../config/index.js";
import { renderExplain, renderJSONExplain } from "../../reporter/index.js";
import { readFileOrNull } from "../../utils/index.js";
import { EXIT_OK, EXIT_ISSUES, EXIT_ERROR } from "../../types.js";
import type { CommandOptions } from "../options.js";

export function explainCommand(
  cwd: string,
  variableName: string,
  opts: CommandOptions = {},
): number {
  if (!variableName) {
    console.error("Please specify a variable name.\n\n  env-doctor explain DATABASE_URL");
    return EXIT_ERROR;
  }

  let config = null;
  try {
    config = loadConfig(cwd, opts.config);
  } catch (err) {
    console.error((err as Error).message);
    return EXIT_ERROR;
  }

  const exampleFile = opts.exampleFile ?? ".env.example";
  const envFile = opts.envFile ?? ".env";

  const exampleContent = readFileOrNull(cwd, exampleFile);
  const envContent = readFileOrNull(cwd, envFile);

  const exampleEntries = exampleContent
    ? parseEnvContent(exampleContent).entries
    : [];
  const envEntries = envContent ? parseEnvContent(envContent).entries : [];

  const result = explain({
    key: variableName,
    envEntries,
    exampleEntries,
    config,
  });

  if (opts.json) {
    const exitCode = result.issues.length > 0 ? EXIT_ISSUES : EXIT_OK;
    console.log(renderJSONExplain(result, { root: cwd, exitCode }));
  } else {
    console.log(renderExplain(result));
  }

  return result.issues.length > 0 ? EXIT_ISSUES : EXIT_OK;
}
