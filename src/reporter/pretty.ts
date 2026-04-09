import pc from "picocolors";
import type { AnalysisResult, Issue, IssueKind } from "../types.js";
import type { DiffResult } from "../core/diff.js";

const ICONS: Record<IssueKind, string> = {
  missing: "✖",
  extra: "ℹ",
  empty: "⚠",
  invalid_type: "⚠",
  dangerous_value: "⚠",
  parse_warning: "⚠",
};

const SECTION_TITLES: Record<IssueKind, string> = {
  missing: "Missing variables",
  empty: "Empty values",
  invalid_type: "Invalid values",
  dangerous_value: "Dangerous defaults",
  extra: "Extra variables",
  parse_warning: "Parse warnings",
};

const SECTION_ORDER: IssueKind[] = [
  "missing",
  "empty",
  "invalid_type",
  "dangerous_value",
  "extra",
  "parse_warning",
];

function colorForKind(kind: IssueKind): (s: string) => string {
  switch (kind) {
    case "missing":
      return pc.red;
    case "empty":
    case "invalid_type":
    case "dangerous_value":
    case "parse_warning":
      return pc.yellow;
    case "extra":
      return pc.cyan;
  }
}

function renderIssue(issue: Issue): string {
  const lines: string[] = [];
  lines.push(`  ${pc.dim("─")} ${pc.bold(issue.message)}`);
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
    lines.push(pc.green("✔ All environment variables look good!"));
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
    lines.push(pc.green("✔ .env and .env.example have the same keys."));
    if (diff.inBoth.length > 0) {
      lines.push(pc.dim(`  ${diff.inBoth.length} variable${diff.inBoth.length !== 1 ? "s" : ""} in both files.`));
    }
    lines.push("");
    return lines.join("\n");
  }

  if (diff.onlyInExample.length > 0) {
    lines.push(pc.red(`✖ Only in .env.example (missing from .env):`));
    for (const key of diff.onlyInExample) {
      lines.push(`  ${pc.red("+")} ${key}`);
    }
    lines.push("");
  }

  if (diff.onlyInEnv.length > 0) {
    lines.push(pc.cyan(`ℹ Only in .env (not in .env.example):`));
    for (const key of diff.onlyInEnv) {
      lines.push(`  ${pc.cyan("−")} ${key}`);
    }
    lines.push("");
  }

  if (diff.inBoth.length > 0) {
    lines.push(pc.green(`✔ In both files (${diff.inBoth.length}):`));
    for (const key of diff.inBoth) {
      lines.push(`  ${pc.green("=")} ${key}`);
    }
    lines.push("");
  }

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
