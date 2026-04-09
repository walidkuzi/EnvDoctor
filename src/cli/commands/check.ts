import { parseEnvContent } from "../../parser/index.js";
import { analyze } from "../../core/index.js";
import { loadConfig } from "../../config/index.js";
import { renderAnalysis, renderJSONAnalysis } from "../../reporter/index.js";
import { readFileOrNull } from "../../utils/index.js";
import { detectFramework, checkFrameworkIssues } from "../../framework/index.js";
import { EXIT_OK, EXIT_ISSUES, EXIT_ERROR } from "../../types.js";
import type { CommandOptions } from "../options.js";

export function checkCommand(cwd: string, opts: CommandOptions = {}): number {
  const exampleFile = opts.exampleFile ?? ".env.example";
  const envFile = opts.envFile ?? ".env";

  const exampleContent = readFileOrNull(cwd, exampleFile);
  if (exampleContent === null) {
    console.error(
      `Could not find ${exampleFile} in the current directory.\n` +
        "This file is used as the reference for expected variables.\n" +
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

  let config = null;
  try {
    config = loadConfig(cwd, opts.config);
  } catch (err) {
    console.error((err as Error).message);
    return EXIT_ERROR;
  }

  const example = parseEnvContent(exampleContent);
  const env = parseEnvContent(envContent);
  const result = analyze({ env, example, config });

  // Framework checks
  const framework = detectFramework(cwd, config?.framework);
  if (framework) {
    const frameworkIssues = checkFrameworkIssues(env.entries, framework);
    result.issues.push(...frameworkIssues);
    for (const issue of frameworkIssues) {
      if (issue.severity === "warning") result.summary.warnings++;
      else if (issue.severity === "info") result.summary.infos++;
    }
  }

  if (opts.json) {
    console.log(renderJSONAnalysis(result, "check"));
  } else {
    console.log(renderAnalysis(result));
  }

  if (opts.failOnWarning && result.summary.warnings > 0) {
    return EXIT_ISSUES;
  }
  return result.summary.errors > 0 ? EXIT_ISSUES : EXIT_OK;
}
