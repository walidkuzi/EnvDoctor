import type { AnalysisResult, Issue } from "../types.js";

export function renderCIAnalysis(result: AnalysisResult, quiet = false): string {
  const lines: string[] = [];

  if (result.issues.length === 0) {
    if (!quiet) lines.push("env-doctor: OK");
    return lines.join("\n");
  }

  if (!quiet) {
    for (const issue of result.issues) {
      const prefix = severityPrefix(issue);
      lines.push(`${prefix} ${issue.key}: ${issue.message}`);
    }
    lines.push("");
  }

  lines.push(
    `env-doctor: ${result.summary.errors} error(s), ${result.summary.warnings} warning(s), ${result.summary.infos} info(s)`,
  );

  return lines.join("\n");
}

function severityPrefix(issue: Issue): string {
  switch (issue.severity) {
    case "error":
      return "[ERROR]";
    case "warning":
      return "[WARN]";
    case "info":
      return "[INFO]";
  }
}
