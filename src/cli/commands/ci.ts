import { parseEnvContent } from "../../parser/index.js";
import { analyze } from "../../core/index.js";
import { loadConfig } from "../../config/index.js";
import { renderCIAnalysis, renderJSONAnalysis } from "../../reporter/index.js";
import { readFileOrNull } from "../../utils/index.js";
import { detectFramework, checkFrameworkIssues } from "../../framework/index.js";
import { EXIT_OK, EXIT_ISSUES, EXIT_ERROR } from "../../types.js";
import type { CommandOptions } from "../options.js";

export function ciCommand(cwd: string, opts: CommandOptions = {}): number {
  const exampleFile = opts.exampleFile ?? ".env.example";
  const envFile = opts.envFile ?? ".env";

  const exampleContent = readFileOrNull(cwd, exampleFile);
  if (exampleContent === null) {
    if (opts.json) {
      console.log(JSON.stringify({ error: `${exampleFile} not found` }));
    } else {
      console.error(`[ERROR] ${exampleFile} not found`);
    }
    return EXIT_ERROR;
  }

  const envContent = readFileOrNull(cwd, envFile);
  if (envContent === null) {
    if (opts.json) {
      console.log(JSON.stringify({ error: `${envFile} not found` }));
    } else {
      console.error(`[ERROR] ${envFile} not found`);
    }
    return EXIT_ERROR;
  }

  let config = null;
  try {
    config = loadConfig(cwd, opts.config);
  } catch (err) {
    const msg = (err as Error).message;
    if (opts.json) {
      console.log(JSON.stringify({ error: msg }));
    } else {
      console.error(`[ERROR] ${msg}`);
    }
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
    const exitCode =
      result.summary.errors > 0
        ? EXIT_ISSUES
        : opts.failOnWarning && result.summary.warnings > 0
          ? EXIT_ISSUES
          : EXIT_OK;
    console.log(renderJSONAnalysis(result, "ci", { root: cwd, exitCode }));
  } else {
    console.log(renderCIAnalysis(result, opts.quiet));
  }

  if (opts.failOnWarning && result.summary.warnings > 0) {
    return EXIT_ISSUES;
  }
  return result.summary.errors > 0 ? EXIT_ISSUES : EXIT_OK;
}
