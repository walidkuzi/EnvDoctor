import type { EnvEntry } from "../types.js";

export interface DiffResult {
  onlyInExample: string[];
  onlyInEnv: string[];
  inBoth: string[];
}

export function diffEntries(
  envEntries: EnvEntry[],
  exampleEntries: EnvEntry[],
): DiffResult {
  const envKeys = new Set(envEntries.map((e) => e.key));
  const exampleKeys = new Set(exampleEntries.map((e) => e.key));

  const onlyInExample: string[] = [];
  const onlyInEnv: string[] = [];
  const inBoth: string[] = [];

  for (const key of exampleKeys) {
    if (envKeys.has(key)) {
      inBoth.push(key);
    } else {
      onlyInExample.push(key);
    }
  }

  for (const key of envKeys) {
    if (!exampleKeys.has(key)) {
      onlyInEnv.push(key);
    }
  }

  return { onlyInExample, onlyInEnv, inBoth };
}
