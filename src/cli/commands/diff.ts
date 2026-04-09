import { parseEnvContent } from "../../parser/index.js";
import { diffEntries } from "../../core/index.js";
import { renderDiff } from "../../reporter/index.js";
import { readFileOrNull } from "../../utils/index.js";
import { EXIT_OK, EXIT_ISSUES, EXIT_ERROR } from "../../types.js";

export function diffCommand(cwd: string): number {
  const exampleContent = readFileOrNull(cwd, ".env.example");
  if (exampleContent === null) {
    console.error(
      "Could not find .env.example in the current directory.\n" +
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

  const example = parseEnvContent(exampleContent);
  const env = parseEnvContent(envContent);
  const result = diffEntries(env.entries, example.entries);

  console.log(renderDiff(result));

  return result.onlyInExample.length > 0 ? EXIT_ISSUES : EXIT_OK;
}
