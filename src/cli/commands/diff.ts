import { parseEnvContent } from "../../parser/index.js";
import { diffEntries } from "../../core/index.js";
import { renderDiff, renderJSONDiff } from "../../reporter/index.js";
import { readFileOrNull } from "../../utils/index.js";
import { EXIT_OK, EXIT_ISSUES, EXIT_ERROR } from "../../types.js";
import type { CommandOptions } from "../options.js";

export function diffCommand(cwd: string, opts: CommandOptions = {}): number {
  const exampleFile = opts.exampleFile ?? ".env.example";
  const envFile = opts.envFile ?? ".env";

  const exampleContent = readFileOrNull(cwd, exampleFile);
  if (exampleContent === null) {
    console.error(
      `Could not find ${exampleFile} in the current directory.\n` +
        `Create a ${exampleFile} file with your project's required variables.`,
    );
    return EXIT_ERROR;
  }

  const envContent = readFileOrNull(cwd, envFile);
  if (envContent === null) {
    console.error(
      `Could not find ${envFile} in the current directory.\n` +
        `Copy ${exampleFile} to ${envFile} and fill in your values:\n\n` +
        `  cp ${exampleFile} ${envFile}`,
    );
    return EXIT_ERROR;
  }

  const example = parseEnvContent(exampleContent);
  const env = parseEnvContent(envContent);
  const result = diffEntries(env.entries, example.entries);

  if (opts.json) {
    console.log(renderJSONDiff(result));
  } else {
    console.log(renderDiff(result));
  }

  return result.onlyInExample.length > 0 ? EXIT_ISSUES : EXIT_OK;
}
