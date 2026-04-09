import type { AnalysisResult, Issue } from "../types.js";

export function renderCIAnalysis(result: AnalysisResult): string {
  const lines: string[] = [];

  if (result.issues.length === 0) {
    lines.push("env-doctor: OK");
    return lines.join("\n");
  }

  for (const issue of result.issues) {
    const prefix = severityPrefix(issue);
    lines.push(`${prefix} ${issue.key}: ${issue.message}`);
  }

  const { errors, warnings, infos } = result.summary;
  lines.push("");
  lines.push(
    `env-doctor: ${errors} error(s), ${warnings} warning(s), ${infos} info(s)`,
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
