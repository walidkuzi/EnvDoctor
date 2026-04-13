import pc from "picocolors";
import { parseEnvContent } from "../../parser/index.js";
import { loadConfig } from "../../config/index.js";
import { validateType, typeExample } from "../../validators/index.js";
import { inferVariable } from "../../inference/index.js";
import { readFileOrNull } from "../../utils/index.js";
import { EXIT_OK, EXIT_ISSUES, EXIT_ERROR } from "../../types.js";
import type { Issue, ValueType } from "../../types.js";
import type { CommandOptions } from "../options.js";
import {
  buildJsonEnvelope,
  TOOL_VERSION,
  toSchemaIssue,
} from "../../output/index.js";

export function validateCommand(cwd: string, opts: CommandOptions = {}): number {
  const envFile = opts.envFile ?? ".env";

  const envContent = readFileOrNull(cwd, envFile);
  if (envContent === null) {
    console.error(
      `Could not find ${envFile} in the current directory.\n` +
        `Create a ${envFile} file with your environment variables.`,
    );
    return EXIT_ERROR;
  }

  let config = null;
  try {
    config = loadConfig(cwd, opts.config);
  } catch (err) {
    console.error((err as Error).message);
    return EXIT_ERROR;
  }

  // Read .env.example for type inference
  const exampleFile = opts.exampleFile ?? ".env.example";
  const exampleContent = readFileOrNull(cwd, exampleFile);
  const exampleMap = new Map<string, string>();
  if (exampleContent) {
    const exampleParsed = parseEnvContent(exampleContent);
    for (const entry of exampleParsed.entries) {
      exampleMap.set(entry.key, entry.value);
    }
  }

  const env = parseEnvContent(envContent);
  let invalidCount = 0;
  const issues: Issue[] = [];
  const lines: string[] = [""];

  for (const entry of env.entries) {
    if (entry.value === "" || entry.value.trim() === "") continue;

    // Resolve type from config or inference
    const configType = config?.types?.[entry.key];
    let expectedType: ValueType | undefined;
    let enumValues: string[] | undefined;

    if (configType) {
      if (typeof configType === "object" && configType.type === "enum") {
        expectedType = "enum";
        enumValues = configType.values;
      } else {
        expectedType = configType as ValueType;
      }
    } else {
      const exampleValue = exampleMap.get(entry.key);
      const inferred = inferVariable(entry.key, entry.value, exampleValue);
      if (inferred.type !== "string") {
        expectedType = inferred.type;
        enumValues = inferred.enumValues;
      }
    }

    if (!expectedType || expectedType === "string") continue;

    if (expectedType === "enum" && enumValues) {
      if (enumValues.includes(entry.value)) {
        if (!opts.json) {
          lines.push(`  ${pc.green("\u2714")} ${entry.key} is a valid enum value`);
        }
      } else {
        if (!opts.json) {
          lines.push(
            `  ${pc.red("\u2716")} ${entry.key} should be one of: ${enumValues.join(", ")}. Found "${entry.value}"`,
          );
          lines.push(`    ${pc.dim("Example:")} ${pc.green(`${entry.key}=${enumValues[0]}`)}`);
        }
        issues.push({
          kind: "invalid_enum",
          severity: "warning",
          key: entry.key,
          message: `${entry.key} should be one of: ${enumValues.join(", ")}. Found "${entry.value}".`,
          example: `${entry.key}=${enumValues[0]}`,
        });
        invalidCount++;
      }
    } else {
      const valid = validateType(entry.value, expectedType);
      if (valid) {
        if (!opts.json) {
          lines.push(`  ${pc.green("\u2714")} ${entry.key} is a valid ${expectedType}`);
        }
      } else {
        if (!opts.json) {
          lines.push(
            `  ${pc.red("\u2716")} ${entry.key} should be a ${expectedType}, but found "${entry.value}"`,
          );
          lines.push(`    ${pc.dim("Example:")} ${pc.green(`${entry.key}=${typeExample(expectedType)}`)}`);
        }
        issues.push({
          kind: "invalid_type",
          severity: "warning",
          key: entry.key,
          message: `${entry.key} should be a ${expectedType}, but found "${entry.value}".`,
          example: `${entry.key}=${typeExample(expectedType)}`,
        });
        invalidCount++;
      }
    }
  }

  if (opts.json) {
    const summary = {
      errors: 0,
      warnings: invalidCount,
      infos: 0,
      total: env.entries.length,
      valid: env.entries.length - invalidCount,
    };
    const exitCode =
      invalidCount > 0 && (opts.failOnWarning || false) ? EXIT_ISSUES : invalidCount > 0 ? EXIT_ISSUES : EXIT_OK;
    const envelope = buildJsonEnvelope({
      command: "validate",
      root: cwd,
      issues: issues.map(toSchemaIssue),
      exitCode,
    });
    // Preserve the legacy `version` and `summary` shape. The `issues`
    // array in the envelope is the rich schema form (a superset of v0.2).
    const legacy = { version: TOOL_VERSION, summary };
    console.log(JSON.stringify({ ...envelope, ...legacy }, null, 2));
  } else {
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
  }

  if (opts.failOnWarning && invalidCount > 0) {
    return EXIT_ISSUES;
  }
  return invalidCount > 0 ? EXIT_ISSUES : EXIT_OK;
}
