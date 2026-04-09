import type { EnvEntry, ParseResult, ParseWarning } from "../types.js";

export function parseEnvContent(content: string): ParseResult {
  const entries: EnvEntry[] = [];
  const warnings: ParseWarning[] = [];
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNumber = i + 1;
    const trimmed = raw.trim();

    // Skip empty lines and comments
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    const eqIndex = trimmed.indexOf("=");

    if (eqIndex === -1) {
      // Line has no `=` — might be a typo or malformed
      if (/^[A-Z_][A-Z0-9_]*$/i.test(trimmed)) {
        // Looks like a key with no value assignment
        warnings.push({
          line: lineNumber,
          raw,
          message: `"${trimmed}" looks like a variable name but has no "=" sign.`,
        });
      } else {
        warnings.push({
          line: lineNumber,
          raw,
          message: `Could not parse this line. Expected KEY=value format.`,
        });
      }
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    if (!key) {
      warnings.push({
        line: lineNumber,
        raw,
        message: `Line has "=" but no variable name before it.`,
      });
      continue;
    }

    // Strip surrounding quotes from value
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Strip inline comments (only for unquoted values)
    const originalValue = trimmed.slice(eqIndex + 1).trim();
    if (!originalValue.startsWith('"') && !originalValue.startsWith("'")) {
      const commentIndex = value.indexOf(" #");
      if (commentIndex !== -1) {
        value = value.slice(0, commentIndex).trim();
      }
    }

    entries.push({ key, value, line: lineNumber, raw });
  }

  return { entries, warnings };
}
