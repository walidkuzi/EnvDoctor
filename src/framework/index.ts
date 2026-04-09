import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { EnvEntry, FrameworkId, FrameworkInfo, Issue } from "../types.js";

const FRAMEWORKS: Record<Exclude<FrameworkId, "none">, FrameworkInfo> = {
  nextjs: { id: "nextjs", name: "Next.js", publicPrefix: "NEXT_PUBLIC_" },
  vite: { id: "vite", name: "Vite", publicPrefix: "VITE_" },
};

const SECRET_NAME_PATTERNS = [
  "SECRET", "TOKEN", "KEY", "PASSWORD", "PASS", "JWT",
  "PRIVATE", "AUTH", "CREDENTIAL",
];

function looksLikeSecretName(key: string): boolean {
  const upper = key.toUpperCase();
  return SECRET_NAME_PATTERNS.some((p) => upper.includes(p));
}

/**
 * Detect the framework used in the project by checking package.json dependencies.
 */
export function detectFramework(cwd: string, configHint?: string): FrameworkInfo | null {
  if (configHint === "none") return null;

  if (configHint && configHint !== "auto") {
    const info = FRAMEWORKS[configHint as Exclude<FrameworkId, "none">];
    return info ?? null;
  }

  // Auto-detect from package.json
  const pkgPath = resolve(cwd, "package.json");
  if (!existsSync(pkgPath)) return null;

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    if (allDeps["next"]) return FRAMEWORKS.nextjs;
    if (allDeps["vite"]) return FRAMEWORKS.vite;
  } catch {
    // Ignore parse errors in package.json
  }

  return null;
}

/**
 * Generate framework-specific warnings for env variables.
 */
export function checkFrameworkIssues(
  entries: EnvEntry[],
  framework: FrameworkInfo,
): Issue[] {
  const issues: Issue[] = [];

  for (const entry of entries) {
    const upper = entry.key.toUpperCase();

    // Warn about secrets exposed via public prefix
    if (upper.startsWith(framework.publicPrefix) && looksLikeSecretName(entry.key)) {
      issues.push({
        kind: "framework_warning",
        severity: "warning",
        key: entry.key,
        message: `${entry.key} uses the ${framework.publicPrefix} prefix, which exposes it to the browser in ${framework.name}.`,
        hint: `Variables containing secrets should not use the ${framework.publicPrefix} prefix. Remove the prefix or use a server-side variable instead.`,
      });
    }

    // Warn about client-intended variables that are missing the public prefix
    if (looksLikeClientVariable(entry.key) && !upper.startsWith(framework.publicPrefix)) {
      // Only warn if the variable doesn't look secret-like
      if (!looksLikeSecretName(entry.key)) {
        issues.push({
          kind: "framework_warning",
          severity: "info",
          key: entry.key,
          message: `${entry.key} might need the ${framework.publicPrefix} prefix to be accessible in ${framework.name} browser code.`,
          hint: `If this variable is used in the browser, rename it to ${framework.publicPrefix}${entry.key}.`,
        });
      }
    }
  }

  return issues;
}

/** Variable names that strongly suggest server-only usage. */
const SERVER_ONLY_PATTERNS = [
  "DATABASE", "DB_", "REDIS", "MONGO", "MYSQL", "POSTGRES",
  "SMTP", "MAIL_HOST", "MAIL_PORT",
  "AWS_", "S3_", "GCP_", "AZURE_",
];

/**
 * Heuristic: does this variable name suggest client/frontend usage?
 */
function looksLikeClientVariable(key: string): boolean {
  const upper = key.toUpperCase();

  // Exclude server-only patterns
  if (SERVER_ONLY_PATTERNS.some((p) => upper.includes(p))) {
    return false;
  }

  const clientPatterns = [
    "PUBLIC_",
    "FRONTEND_",
    "CLIENT_URL",
    "BROWSER_",
    "APP_URL",
    "SITE_URL",
    "ANALYTICS_",
    "GA_",
    "GTM_",
    "SENTRY_DSN",
  ];

  return clientPatterns.some((p) => upper.includes(p));
}
