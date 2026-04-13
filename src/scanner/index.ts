import { extractUsagesFromSource, type SourceUsage } from "./extract.js";
import {
  DEFAULT_SCAN_PATHS,
  walkScanPaths,
  type WalkedFile,
} from "./walk.js";
import { findTypos, type TypoCandidate } from "./typos.js";

export interface ScanOptions {
  paths?: string[];
  include?: string[];
  exclude?: string[];
  minTypoScore?: number;
}

export interface ScanResult {
  usedKeys: string[];
  definedKeys: string[];
  usages: SourceUsage[];
  usedButUndefined: string[];
  definedButUnused: string[];
  typos: TypoCandidate[];
  filesScanned: number;
}

export interface ScanInput {
  root: string;
  /** Keys present in .env.example / .env (the "contract"). */
  contractKeys: Iterable<string>;
  options?: ScanOptions;
}

export const DEFAULT_MIN_TYPO_SCORE = 0.82;

export function scanSources(input: ScanInput): ScanResult {
  const { root, options = {} } = input;
  const paths = options.paths ?? DEFAULT_SCAN_PATHS;
  const minTypoScore = options.minTypoScore ?? DEFAULT_MIN_TYPO_SCORE;

  const files: WalkedFile[] = walkScanPaths(root, paths, {
    extraIncludes: options.include,
    extraExcludes: options.exclude,
  });

  const usages: SourceUsage[] = [];
  for (const f of files) {
    const fileUsages = extractUsagesFromSource(f.content, f.relative);
    for (const u of fileUsages) usages.push(u);
  }

  const usedSet = new Set(usages.map((u) => u.key));
  const definedSet = new Set(input.contractKeys);

  const usedButUndefined = [...usedSet]
    .filter((k) => !definedSet.has(k))
    .sort();
  const definedButUnused = [...definedSet]
    .filter((k) => !usedSet.has(k))
    .sort();

  // For typo detection, exclude keys that we're going to report as
  // "used but undefined" if they match a defined key closely — and also
  // filter out "used but undefined" that are actually typos.
  const typos = findTypos(usedButUndefined, definedSet, minTypoScore);
  const typoUsedKeys = new Set(typos.map((t) => t.used));

  const usedButUndefinedFiltered = usedButUndefined.filter(
    (k) => !typoUsedKeys.has(k),
  );

  return {
    usedKeys: [...usedSet].sort(),
    definedKeys: [...definedSet].sort(),
    usages,
    usedButUndefined: usedButUndefinedFiltered,
    definedButUnused,
    typos,
    filesScanned: files.length,
  };
}

export { extractUsagesFromSource } from "./extract.js";
export { walkScanPaths, DEFAULT_SCAN_PATHS } from "./walk.js";
export { findTypos, similarity } from "./typos.js";
export type { SourceUsage } from "./extract.js";
export type { TypoCandidate } from "./typos.js";
