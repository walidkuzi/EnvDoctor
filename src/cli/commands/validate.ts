import pc from "picocolors";
import { parseEnvContent } from "../../parser/index.js";
import { loadConfig } from "../../config/index.js";
import { inferType, validateType, typeExample } from "../../validators/index.js";
import { readFileOrNull } from "../../utils/index.js";
import { EXIT_OK, EXIT_ISSUES, EXIT_ERROR } from "../../types.js";
import type { ValueType } from "../../types.js";

export function validateCommand(cwd: string): number {
  const envContent = readFileOrNull(cwd, ".env");
  if (envContent === null) {
    console.error(
      "Could not find .env in the current directory.\n" +
        "Create a .env file with your environment variables.",
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

  // Also read .env.example for type inference
  const exampleContent = readFileOrNull(cwd, ".env.example");
  const exampleMap = new Map<string, string>();
  if (exampleContent) {
    const exampleParsed = parseEnvContent(exampleContent);
    for (const entry of exampleParsed.entries) {
      exampleMap.set(entry.key, entry.value);
    }
  }

  const env = parseEnvContent(envContent);
  let invalidCount = 0;
  const lines: string[] = [""];

  for (const entry of env.entries) {
    if (entry.value === "" || entry.value.trim() === "") continue;

    const configType = config?.types?.[entry.key];
    const exampleValue = exampleMap.get(entry.key);
    const inferred: ValueType | null = exampleValue ? inferType(exampleValue) : null;
    const expectedType = configType ?? inferred;

    if (!expectedType || expectedType === "string") continue;

    const valid = validateType(entry.value, expectedType);
    if (valid) {
      lines.push(`  ${pc.green("✔")} ${entry.key} is a valid ${expectedType}`);
    } else {
      lines.push(
        `  ${pc.red("✖")} ${entry.key} should be a ${expectedType}, but found "${entry.value}"`,
      );
      lines.push(`    ${pc.dim("Example:")} ${pc.green(`${entry.key}=${typeExample(expectedType)}`)}`);
      invalidCount++;
    }
  }

  if (lines.length <= 1) {
    lines.push(pc.dim("  No typed variables to validate."));
    lines.push(pc.dim("  Add types in env-doctor.json or .env.example to enable validation."));
  }

  lines.push("");

  if (invalidCount > 0) {
    lines.push(pc.red(`${invalidCount} invalid value${invalidCount !== 1 ? "s" : ""} found.`));
  } else {
    lines.push(pc.green("All values are valid."));
  }
  lines.push("");

  console.log(lines.join("\n"));

  return invalidCount > 0 ? EXIT_ISSUES : EXIT_OK;
}
