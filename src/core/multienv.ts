import type { MultiEnvEntry, MultiEnvResult, ParseResult } from "../types.js";

const DEFAULT_ENV_FILES = [
  ".env",
  ".env.example",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.test",
];

export function getEnvFileList(configFiles?: string[]): string[] {
  return configFiles ?? DEFAULT_ENV_FILES;
}

interface MultiEnvInput {
  files: Map<string, ParseResult>;
}

/**
 * Build a matrix showing which variables exist in which files.
 */
export function buildMultiEnvMatrix(input: MultiEnvInput): MultiEnvResult {
  const fileNames = [...input.files.keys()].sort();

  // Collect all unique keys across all files
  const allKeys = new Set<string>();
  for (const [, parsed] of input.files) {
    for (const entry of parsed.entries) {
      allKeys.add(entry.key);
    }
  }

  const sortedKeys = [...allKeys].sort();

  // Build the matrix
  const matrix: MultiEnvEntry[] = sortedKeys.map((key) => {
    const files: Record<string, string | null> = {};
    for (const fileName of fileNames) {
      const parsed = input.files.get(fileName)!;
      const entry = parsed.entries.find((e) => e.key === key);
      files[fileName] = entry ? entry.value : null;
    }
    return { key, files };
  });

  return {
    keys: sortedKeys,
    files: fileNames,
    matrix,
  };
}
