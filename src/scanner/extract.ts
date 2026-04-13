/**
 * Extract env var references from JavaScript/TypeScript source code.
 *
 * v0.3 uses regex-based scanning for speed and to avoid an AST dependency.
 * We support the most common patterns:
 *
 *   - process.env.KEY
 *   - process.env["KEY"]
 *   - process.env['KEY']
 *   - process?.env?.KEY
 *   - import.meta.env.KEY
 *   - import.meta.env["KEY"]
 *
 * Edge cases explicitly NOT supported (deferred to v0.4):
 *   - destructuring:  const { KEY } = process.env
 *   - dynamic keys:   process.env[someVar]
 *   - template literals in bracket access
 */

export interface SourceUsage {
  key: string;
  file: string;
  line: number;
  column: number;
  snippet: string;
}

// Matches `.` or `?.`  (for optional chaining)
const DOT = String.raw`(?:\?\.|\.)`;
// Matches `[` possibly preceded by `?.` (for optional chain bracket)
const BRACKET = String.raw`(?:\?\.)?\[`;
// Uppercase-ish identifier (env keys are conventionally SHOUTY_SNAKE_CASE)
const KEY = String.raw`[A-Z_][A-Z0-9_]*`;

const USAGE_REGEX = new RegExp(
  [
    // process.env.KEY  or  process?.env?.KEY
    String.raw`process\s*${DOT}\s*env\s*${DOT}\s*(${KEY})`,
    // process.env["KEY"]  or  process.env['KEY']
    String.raw`process\s*${DOT}\s*env\s*${BRACKET}\s*(?:"(${KEY})"|'(${KEY})')\s*\]`,
    // import.meta.env.KEY
    String.raw`import\s*\.\s*meta\s*\.\s*env\s*\.\s*(${KEY})`,
    // import.meta.env["KEY"] / ['KEY']
    String.raw`import\s*\.\s*meta\s*\.\s*env\s*\[\s*(?:"(${KEY})"|'(${KEY})')\s*\]`,
  ].join("|"),
  "g",
);

/**
 * Extract all env key usages from a single source string.
 */
export function extractUsagesFromSource(
  source: string,
  file: string,
): SourceUsage[] {
  const results: SourceUsage[] = [];
  const stripped = stripLineComments(source);
  const lines = stripped.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes("env")) continue; // fast path

    USAGE_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = USAGE_REGEX.exec(line)) !== null) {
      const key =
        match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5] ?? match[6];
      if (!key) continue;

      results.push({
        key,
        file,
        line: i + 1,
        column: match.index + 1,
        snippet: line.trim().slice(0, 160),
      });
    }
  }

  return results;
}

/**
 * Strip `//` line comments but preserve string contents roughly.
 * This is a simplified pass — full correctness would need a tokenizer.
 */
function stripLineComments(source: string): string {
  const lines = source.split(/\r?\n/);
  const out: string[] = [];

  for (const line of lines) {
    let inString: '"' | "'" | "`" | null = null;
    let escaped = false;
    let cut = -1;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }

      if (inString) {
        if (ch === inString) inString = null;
        continue;
      }

      if (ch === '"' || ch === "'" || ch === "`") {
        inString = ch;
        continue;
      }

      if (ch === "/" && line[i + 1] === "/") {
        cut = i;
        break;
      }
    }

    out.push(cut === -1 ? line : line.slice(0, cut));
  }

  return out.join("\n");
}
