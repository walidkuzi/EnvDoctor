import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const DEFAULT_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
]);

const DEFAULT_EXCLUDES = new Set([
  "node_modules",
  "dist",
  "build",
  ".next",
  ".nuxt",
  ".svelte-kit",
  ".turbo",
  "coverage",
  ".git",
  ".cache",
  "out",
  "vendor",
]);

export const DEFAULT_SCAN_PATHS = [
  "src",
  "app",
  "pages",
  "server",
  "lib",
  "packages",
];

export interface WalkOptions {
  includeExtensions?: Set<string>;
  excludeDirs?: Set<string>;
  maxFileBytes?: number;
  /**
   * Extra glob-ish patterns to exclude. v0.3 supports simple suffix/substring
   * matching — no full glob engine to avoid a dependency.
   */
  extraExcludes?: string[];
  /**
   * Extra glob-ish patterns to restrict to.
   */
  extraIncludes?: string[];
}

export interface WalkedFile {
  absolute: string;
  relative: string;
  content: string;
}

/**
 * Walk the default + configured scan paths, returning file contents for
 * every file with a supported extension.
 */
export function walkScanPaths(
  root: string,
  scanPaths: string[],
  options: WalkOptions = {},
): WalkedFile[] {
  const exts = options.includeExtensions ?? DEFAULT_EXTENSIONS;
  const excludes = new Set([
    ...DEFAULT_EXCLUDES,
    ...(options.excludeDirs ?? []),
  ]);
  const maxBytes = options.maxFileBytes ?? 1_500_000; // 1.5 MB
  const results: WalkedFile[] = [];
  const seen = new Set<string>();

  for (const p of scanPaths) {
    const abs = resolve(root, p);
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue; // scan path does not exist — skip silently
    }

    if (st.isDirectory()) {
      walkDir(abs, root, exts, excludes, maxBytes, results, seen, options);
    } else if (st.isFile() && exts.has(extnameLower(abs))) {
      readIntoResults(abs, root, results, seen, maxBytes);
    }
  }

  return results;
}

function walkDir(
  dir: string,
  root: string,
  exts: Set<string>,
  excludes: Set<string>,
  maxBytes: number,
  results: WalkedFile[],
  seen: Set<string>,
  options: WalkOptions,
): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".") && excludes.has(entry.name)) continue;
    if (excludes.has(entry.name)) continue;

    const full = join(dir, entry.name);
    const rel = relative(root, full);

    if (matchesAny(rel, options.extraExcludes)) continue;

    if (entry.isDirectory()) {
      walkDir(full, root, exts, excludes, maxBytes, results, seen, options);
    } else if (entry.isFile()) {
      if (!exts.has(extnameLower(entry.name))) continue;
      if (
        options.extraIncludes &&
        options.extraIncludes.length > 0 &&
        !matchesAny(rel, options.extraIncludes)
      ) {
        continue;
      }
      readIntoResults(full, root, results, seen, maxBytes);
    }
  }
}

function readIntoResults(
  abs: string,
  root: string,
  results: WalkedFile[],
  seen: Set<string>,
  maxBytes: number,
): void {
  if (seen.has(abs)) return;
  seen.add(abs);

  try {
    const st = statSync(abs);
    if (st.size > maxBytes) return;
    const content = readFileSync(abs, "utf-8");
    results.push({
      absolute: abs,
      relative: relative(root, abs),
      content,
    });
  } catch {
    // Unreadable file — skip
  }
}

function extnameLower(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx).toLowerCase();
}

/**
 * Very simple pattern matcher: supports `*` wildcards and literal substrings.
 * Intentionally minimal — avoids pulling in a glob dependency.
 */
function matchesAny(relPath: string, patterns?: string[]): boolean {
  if (!patterns || patterns.length === 0) return false;
  const normalized = relPath.split(sep).join("/");

  for (const raw of patterns) {
    const pattern = raw.trim();
    if (!pattern) continue;

    if (pattern.includes("*")) {
      const re = new RegExp(
        "^" +
          pattern
            .split("/")
            .map((segment) =>
              segment
                .replace(/[.+^${}()|[\]\\]/g, "\\$&")
                .replace(/\*\*/g, ".*")
                .replace(/\*/g, "[^/]*"),
            )
            .join("/") +
          "$",
      );
      if (re.test(normalized)) return true;
    } else if (normalized.includes(pattern)) {
      return true;
    }
  }

  return false;
}
