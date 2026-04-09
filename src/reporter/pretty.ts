import pc from "picocolors";
import type { AnalysisResult, ExplainResult, Issue, IssueKind, MultiEnvResult } from "../types.js";
import type { DiffResult } from "../core/diff.js";

const ICONS: Record<IssueKind, string> = {
  missing: "\u2716",
  extra: "\u2139",
  empty: "\u26A0",
  invalid_type: "\u26A0",
  invalid_enum: "\u26A0",
  dangerous_value: "\u26A0",
  placeholder_value: "\u26A0",
  framework_warning: "\u26A0",
  parse_warning: "\u26A0",
};

const SECTION_TITLES: Record<IssueKind, string> = {
  missing: "Missing variables",
  empty: "Empty values",
  invalid_type: "Invalid values",
  invalid_enum: "Invalid enum values",
  dangerous_value: "Dangerous defaults",
  placeholder_value: "Placeholder values",
  framework_warning: "Framework warnings",
  extra: "Extra variables",
  parse_warning: "Parse warnings",
};

const SECTION_ORDER: IssueKind[] = [
  "missing",
  "empty",
  "invalid_type",
  "invalid_enum",
  "dangerous_value",
  "placeholder_value",
  "framework_warning",
  "extra",
  "parse_warning",
];

function colorForKind(kind: IssueKind): (s: string) => string {
  switch (kind) {
    case "missing":
      return pc.red;
    case "empty":
    case "invalid_type":
    case "invalid_enum":
    case "dangerous_value":
    case "placeholder_value":
    case "framework_warning":
    case "parse_warning":
      return pc.yellow;
    case "extra":
      return pc.cyan;
  }
}

function renderIssue(issue: Issue): string {
  const lines: string[] = [];
  lines.push(`  ${pc.dim("\u2500")} ${pc.bold(issue.message)}`);
  if (issue.hint) {
    lines.push(`    ${issue.hint}`);
  }
  if (issue.example) {
    lines.push(`    ${pc.dim("Example:")} ${pc.green(issue.example)}`);
  }
  return lines.join("\n");
}

export function renderAnalysis(result: AnalysisResult): string {
  const lines: string[] = [];
  const grouped = groupByKind(result.issues);

  if (result.issues.length === 0) {
    lines.push("");
    lines.push(pc.green("\u2714 All environment variables look good!"));
    lines.push("");
    return lines.join("\n");
  }

  lines.push("");

  for (const kind of SECTION_ORDER) {
    const issues = grouped.get(kind);
    if (!issues || issues.length === 0) continue;

    const icon = ICONS[kind];
    const title = SECTION_TITLES[kind];
    const color = colorForKind(kind);

    lines.push(color(`${icon} ${title}`));
    for (const issue of issues) {
      lines.push(renderIssue(issue));
    }
    lines.push("");
  }

  // Summary
  const { errors, warnings, infos } = result.summary;
  const parts: string[] = [];
  if (errors > 0) parts.push(pc.red(`${errors} error${errors !== 1 ? "s" : ""}`));
  if (warnings > 0) parts.push(pc.yellow(`${warnings} warning${warnings !== 1 ? "s" : ""}`));
  if (infos > 0) parts.push(pc.cyan(`${infos} info${infos !== 1 ? "s" : ""}`));

  lines.push(pc.bold("Summary:") + " " + parts.join(", "));
  lines.push("");

  return lines.join("\n");
}

export function renderDiff(diff: DiffResult): string {
  const lines: string[] = [];
  lines.push("");

  if (diff.onlyInExample.length === 0 && diff.onlyInEnv.length === 0) {
    lines.push(pc.green("\u2714 .env and .env.example have the same keys."));
    if (diff.inBoth.length > 0) {
      lines.push(pc.dim(`  ${diff.inBoth.length} variable${diff.inBoth.length !== 1 ? "s" : ""} in both files.`));
    }
    lines.push("");
    return lines.join("\n");
  }

  if (diff.onlyInExample.length > 0) {
    lines.push(pc.red("\u2716 Only in .env.example (missing from .env):"));
    for (const key of diff.onlyInExample) {
      lines.push(`  ${pc.red("+")} ${key}`);
    }
    lines.push("");
  }

  if (diff.onlyInEnv.length > 0) {
    lines.push(pc.cyan("\u2139 Only in .env (not in .env.example):"));
    for (const key of diff.onlyInEnv) {
      lines.push(`  ${pc.cyan("\u2212")} ${key}`);
    }
    lines.push("");
  }

  if (diff.inBoth.length > 0) {
    lines.push(pc.green(`\u2714 In both files (${diff.inBoth.length}):`));
    for (const key of diff.inBoth) {
      lines.push(`  ${pc.green("=")} ${key}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function renderExplain(result: ExplainResult): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(pc.bold(`Variable: ${result.key}`));
  lines.push("");

  // Presence
  const envStatus = result.existsInEnv
    ? result.isEmpty
      ? pc.yellow("present but empty")
      : pc.green("set")
    : pc.red("missing");
  const exampleStatus = result.existsInExample ? pc.green("yes") : pc.dim("no");

  lines.push(`  In .env:         ${envStatus}${result.envValue && !result.isEmpty ? pc.dim(` = "${result.envValue}"`) : ""}`);
  lines.push(`  In .env.example: ${exampleStatus}${result.exampleValue ? pc.dim(` = "${result.exampleValue}"`) : ""}`);
  lines.push(`  Required:        ${result.isRequired ? pc.yellow("yes") : pc.dim("no")}`);

  if (result.expectedType) {
    const typeLabel = result.expectedType.type === "enum" && result.expectedType.enumValues
      ? `enum (${result.expectedType.enumValues.join(", ")})`
      : result.expectedType.type;
    lines.push(`  Expected type:   ${typeLabel} ${pc.dim(`(${result.expectedType.source})`)}`);
  }

  // Issues
  if (result.issues.length > 0) {
    lines.push("");
    lines.push(pc.yellow("  Issues:"));
    for (const issue of result.issues) {
      lines.push(`    ${pc.yellow("\u26A0")} ${issue.message}`);
    }
  }

  // Suggestion
  if (result.suggestion) {
    lines.push("");
    lines.push(pc.green(`  Suggestion: ${result.suggestion}`));
  }

  // Closest match
  if (result.closestMatch) {
    lines.push("");
    lines.push(pc.dim(`  Did you mean: ${result.closestMatch}?`));
  }

  if (!result.existsInEnv && !result.existsInExample && !result.closestMatch) {
    lines.push("");
    lines.push(pc.dim("  This variable does not exist in .env or .env.example."));
  }

  lines.push("");
  return lines.join("\n");
}

export function renderMatrix(result: MultiEnvResult): string {
  const lines: string[] = [];
  lines.push("");

  if (result.matrix.length === 0) {
    lines.push(pc.dim("No environment files found."));
    lines.push("");
    return lines.join("\n");
  }

  // Column widths
  const keyWidth = Math.max(12, ...result.keys.map((k) => k.length));
  const colWidth = Math.max(8, ...result.files.map((f) => f.length));

  // Header
  const header =
    pc.bold("Variable".padEnd(keyWidth)) +
    "  " +
    result.files.map((f) => pc.bold(f.padEnd(colWidth))).join("  ");
  lines.push(header);
  lines.push(pc.dim("\u2500".repeat(keyWidth + (colWidth + 2) * result.files.length)));

  // Rows
  for (const entry of result.matrix) {
    const cells = result.files.map((f) => {
      const val = entry.files[f];
      if (val === null) return pc.red("\u2716".padEnd(colWidth));
      if (val === "") return pc.yellow("\u2205".padEnd(colWidth));
      return pc.green("\u2714".padEnd(colWidth));
    });

    lines.push(entry.key.padEnd(keyWidth) + "  " + cells.join("  "));
  }

  // Summary
  const fileCount = result.files.length;
  const keyCount = result.keys.length;
  lines.push("");
  lines.push(pc.dim(`${keyCount} variable${keyCount !== 1 ? "s" : ""} across ${fileCount} file${fileCount !== 1 ? "s" : ""}`));

  // Show drift: variables not present in all files
  const drift = result.matrix.filter((e) =>
    result.files.some((f) => e.files[f] === null),
  );
  if (drift.length > 0) {
    lines.push("");
    lines.push(pc.yellow(`\u26A0 ${drift.length} variable${drift.length !== 1 ? "s" : ""} missing from at least one file:`));
    for (const entry of drift) {
      const missingIn = result.files.filter((f) => entry.files[f] === null);
      lines.push(`  ${pc.yellow("\u2500")} ${entry.key} ${pc.dim("missing in")} ${missingIn.join(", ")}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

function groupByKind(issues: Issue[]): Map<IssueKind, Issue[]> {
  const map = new Map<IssueKind, Issue[]>();
  for (const issue of issues) {
    const list = map.get(issue.kind) ?? [];
    list.push(issue);
    map.set(issue.kind, list);
  }
  return map;
}
