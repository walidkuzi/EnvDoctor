/**
 * Typo detection between "used" and "defined" env keys.
 *
 * We use normalized Levenshtein similarity, biased to ignore case and
 * underscore differences. Keys that are exact matches are never reported.
 */

export interface TypoCandidate {
  used: string;
  suggestion: string;
  score: number;
}

/**
 * Compute normalized similarity score in [0, 1].
 * 1 = identical, 0 = completely different.
 */
export function similarity(a: string, b: string): number {
  const A = normalize(a);
  const B = normalize(b);
  if (A === B) return 1;

  const dist = levenshtein(A, B);
  const maxLen = Math.max(A.length, B.length);
  if (maxLen === 0) return 1;
  return 1 - dist / maxLen;
}

function normalize(s: string): string {
  return s.toUpperCase().replace(/[-_]/g, "");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

/**
 * For each key in `usedKeys` that has no exact match in `definedKeys`,
 * find the closest defined key above `minScore` and return it as a
 * potential typo candidate.
 */
export function findTypos(
  usedKeys: Iterable<string>,
  definedKeys: Iterable<string>,
  minScore: number,
): TypoCandidate[] {
  const defined = Array.from(definedKeys);
  const definedSet = new Set(defined);
  const out: TypoCandidate[] = [];

  for (const used of usedKeys) {
    if (definedSet.has(used)) continue;
    if (defined.length === 0) continue;

    let best: { key: string; score: number } = { key: "", score: 0 };
    for (const d of defined) {
      const score = similarity(used, d);
      if (score > best.score) {
        best = { key: d, score };
      }
    }

    if (best.score >= minScore && best.key !== used) {
      out.push({ used, suggestion: best.key, score: best.score });
    }
  }

  return out;
}
