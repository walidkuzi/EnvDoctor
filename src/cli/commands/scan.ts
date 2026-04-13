import pc from "picocolors";
import { parseEnvContent } from "../../parser/index.js";
import { loadConfig } from "../../config/index.js";
import { readFileOrNull } from "../../utils/index.js";
import { scanSources, DEFAULT_MIN_TYPO_SCORE } from "../../scanner/index.js";
import {
  buildJsonEnvelope,
  serializeEnvelope,
  type SchemaIssue,
} from "../../output/index.js";
import { EXIT_OK, EXIT_ISSUES, EXIT_ERROR } from "../../types.js";
import type { CommandOptions } from "../options.js";

export interface ScanCommandOptions extends CommandOptions {
  paths?: string;
  include?: string;
  exclude?: string;
  minTypoScore?: string;
}

export function scanCommand(cwd: string, opts: ScanCommandOptions = {}): number {
  const exampleFile = opts.exampleFile ?? ".env.example";
  const envFile = opts.envFile ?? ".env";

  let config = null;
  try {
    config = loadConfig(cwd, opts.config);
  } catch (err) {
    emitError(opts, (err as Error).message, cwd);
    return EXIT_ERROR;
  }

  // Build the "contract": keys defined in .env.example (primary),
  // falling back to .env if the example doesn't exist. Config-required
  // keys are always part of the contract.
  const contract = new Set<string>();

  const exampleContent = readFileOrNull(cwd, exampleFile);
  if (exampleContent !== null) {
    for (const e of parseEnvContent(exampleContent).entries) {
      contract.add(e.key);
    }
  }

  const envContent = readFileOrNull(cwd, envFile);
  if (envContent !== null) {
    for (const e of parseEnvContent(envContent).entries) {
      contract.add(e.key);
    }
  }

  if (config?.required) {
    for (const k of config.required) contract.add(k);
  }

  // Parse CLI options
  const paths = opts.paths
    ? opts.paths
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
    : undefined;
  const include = opts.include
    ? opts.include
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
    : undefined;
  const exclude = opts.exclude
    ? opts.exclude
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
    : undefined;

  let minTypoScore = DEFAULT_MIN_TYPO_SCORE;
  if (opts.minTypoScore !== undefined) {
    const n = Number(opts.minTypoScore);
    if (Number.isNaN(n) || n < 0 || n > 1) {
      emitError(
        opts,
        `--min-typo-score must be a number between 0 and 1, got "${opts.minTypoScore}".`,
        cwd,
      );
      return EXIT_ERROR;
    }
    minTypoScore = n;
  }

  const result = scanSources({
    root: cwd,
    contractKeys: contract,
    options: { paths, include, exclude, minTypoScore },
  });

  // Build schema issues
  const issues: SchemaIssue[] = [];

  // Used-but-undefined — ERROR
  for (const key of result.usedButUndefined) {
    const firstUsage = result.usages.find((u) => u.key === key);
    issues.push({
      code: "USED_BUT_UNDEFINED",
      kind: "used_but_undefined",
      severity: "error",
      key,
      message: `${key} is used in code but not defined in ${exampleFile}.`,
      hint: `Add ${key} to ${exampleFile} so teammates know it's required.`,
      example: `${key}=`,
      location: firstUsage
        ? {
            file: firstUsage.file,
            line: firstUsage.line,
            column: firstUsage.column,
          }
        : undefined,
      meta: {
        usageCount: result.usages.filter((u) => u.key === key).length,
      },
    });
  }

  // Defined-but-unused — WARNING (configurable severity stretch in v0.4)
  for (const key of result.definedButUnused) {
    issues.push({
      code: "DEFINED_BUT_UNUSED",
      kind: "unused",
      severity: "warning",
      key,
      message: `${key} is defined in ${exampleFile} but not referenced in source code.`,
      hint: "This may be a leftover variable. Consider removing it or using it.",
    });
  }

  // Potential typos — WARNING
  for (const typo of result.typos) {
    const firstUsage = result.usages.find((u) => u.key === typo.used);
    issues.push({
      code: "POTENTIAL_TYPO",
      kind: "typo",
      severity: "warning",
      key: typo.used,
      message: `${typo.used} is used in code, did you mean ${typo.suggestion}?`,
      hint: `Rename ${typo.used} to ${typo.suggestion}, or add ${typo.used} to ${exampleFile}.`,
      example: typo.suggestion,
      location: firstUsage
        ? {
            file: firstUsage.file,
            line: firstUsage.line,
            column: firstUsage.column,
          }
        : undefined,
      meta: {
        suggestion: typo.suggestion,
        score: typo.score,
      },
    });
  }

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;

  let exitCode: number = EXIT_OK;
  if (errors > 0) exitCode = EXIT_ISSUES;
  else if (opts.failOnWarning && warnings > 0) exitCode = EXIT_ISSUES;

  if (opts.json) {
    const envelope = buildJsonEnvelope({
      command: "scan",
      root: cwd,
      issues,
      exitCode,
      data: {
        filesScanned: result.filesScanned,
        usedKeys: result.usedKeys,
        definedKeys: result.definedKeys,
        usedButUndefined: result.usedButUndefined,
        definedButUnused: result.definedButUnused,
        typos: result.typos,
      },
    });
    console.log(serializeEnvelope(envelope));
    return exitCode;
  }

  renderHuman(result, issues, opts);
  return exitCode;
}

function renderHuman(
  result: ReturnType<typeof scanSources>,
  issues: SchemaIssue[],
  opts: ScanCommandOptions,
): void {
  const lines: string[] = [];
  lines.push("");

  if (result.filesScanned === 0) {
    lines.push(
      pc.yellow(
        "No source files found. Pass --paths to point env-doctor at your code.",
      ),
    );
    lines.push("");
    console.log(lines.join("\n"));
    return;
  }

  lines.push(
    pc.dim(
      `Scanned ${result.filesScanned} file(s), found ${result.usedKeys.length} env key(s) in code.`,
    ),
  );
  lines.push("");

  if (issues.length === 0) {
    lines.push(pc.green("\u2714 Source code matches your env contract."));
    lines.push("");
    console.log(lines.join("\n"));
    return;
  }

  const used = issues.filter((i) => i.code === "USED_BUT_UNDEFINED");
  const unused = issues.filter((i) => i.code === "DEFINED_BUT_UNUSED");
  const typos = issues.filter((i) => i.code === "POTENTIAL_TYPO");

  if (used.length > 0) {
    lines.push(pc.red(`\u2716 Used but undefined (${used.length})`));
    for (const issue of used) {
      const loc = issue.location
        ? pc.dim(`    ${issue.location.file}:${issue.location.line}`)
        : "";
      lines.push(`  ${pc.dim("\u2500")} ${pc.bold(issue.key)}`);
      if (loc) lines.push(loc);
      if (issue.hint) lines.push(`    ${issue.hint}`);
    }
    lines.push("");
  }

  if (typos.length > 0) {
    lines.push(pc.yellow(`\u26A0 Potential typos (${typos.length})`));
    for (const issue of typos) {
      const suggestion = issue.meta?.suggestion as string | undefined;
      const score = issue.meta?.score as number | undefined;
      lines.push(
        `  ${pc.dim("\u2500")} ${pc.bold(issue.key)} ${pc.dim("\u2192")} ${pc.green(
          suggestion ?? "?",
        )} ${pc.dim(`(score ${score?.toFixed(2)})`)}`,
      );
      if (issue.location) {
        lines.push(
          pc.dim(`    ${issue.location.file}:${issue.location.line}`),
        );
      }
    }
    lines.push("");
  }

  if (unused.length > 0 && !opts.quiet) {
    lines.push(pc.yellow(`\u26A0 Defined but unused (${unused.length})`));
    for (const issue of unused) {
      lines.push(`  ${pc.dim("\u2500")} ${issue.key}`);
    }
    lines.push("");
  }

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const parts: string[] = [];
  if (errors > 0) parts.push(pc.red(`${errors} error${errors !== 1 ? "s" : ""}`));
  if (warnings > 0)
    parts.push(pc.yellow(`${warnings} warning${warnings !== 1 ? "s" : ""}`));

  lines.push(pc.bold("Summary:") + " " + (parts.join(", ") || pc.green("clean")));
  lines.push("");

  console.log(lines.join("\n"));
}

function emitError(
  opts: ScanCommandOptions,
  message: string,
  cwd: string,
): void {
  if (opts.json) {
    const envelope = buildJsonEnvelope({
      command: "scan",
      root: cwd,
      issues: [
        {
          code: "PARSE_WARNING",
          kind: "parse_warning",
          severity: "error",
          key: "",
          message,
        },
      ],
      exitCode: EXIT_ERROR,
    });
    console.log(serializeEnvelope(envelope));
  } else {
    console.error(message);
  }
}
