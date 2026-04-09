const DEFAULT_DANGEROUS_VALUES = [
  "123",
  "1234",
  "12345",
  "password",
  "secret",
  "changeme",
  "change_me",
  "your_key_here",
  "your_secret_here",
  "your_api_key",
  "your-api-key",
  "replace_me",
  "todo",
  "tbd",
  "fixme",
  "xxx",
  "test",
  "default",
  "example",
  "sample",
  "dummy",
  "placeholder",
  "jwt_secret",
  "my_secret",
  "mysecret",
  "abc123",
  "qwerty",
  "null",
  "undefined",
  "none",
  "n/a",
  "na",
];

const SECRET_NAME_PATTERNS = [
  "SECRET",
  "TOKEN",
  "KEY",
  "PASSWORD",
  "PASS",
  "JWT",
  "API_KEY",
  "PRIVATE",
  "AUTH",
  "CREDENTIAL",
  "CLIENT_SECRET",
  "API_SECRET",
];

function looksLikeSecretName(key: string): boolean {
  const upper = key.toUpperCase();
  return SECRET_NAME_PATTERNS.some((pattern) => upper.includes(pattern));
}

export interface DangerousCheck {
  isDangerous: boolean;
  kind: "dangerous_value" | "placeholder_value";
  reason?: string;
}

const NOT_DANGEROUS: DangerousCheck = { isDangerous: false, kind: "dangerous_value" };

/**
 * Check whether a value looks dangerous, placeholder-like, or insecure.
 */
export function checkDangerousValue(
  key: string,
  value: string,
  customDangerousValues?: string[],
): DangerousCheck {
  const lower = value.toLowerCase().trim();
  const allDangerous = customDangerousValues
    ? [...DEFAULT_DANGEROUS_VALUES, ...customDangerousValues.map((v) => v.toLowerCase())]
    : DEFAULT_DANGEROUS_VALUES;

  // Check if value matches a known dangerous/placeholder value
  if (allDangerous.includes(lower)) {
    return {
      isDangerous: true,
      kind: "placeholder_value",
      reason: `"${value}" looks like a placeholder or default value.`,
    };
  }

  // Check for repeated character patterns like "aaaa", "xxxx"
  if (value.length >= 3 && /^(.)\1+$/.test(value)) {
    return {
      isDangerous: true,
      kind: "placeholder_value",
      reason: `"${value}" is a repeated character and looks like a placeholder.`,
    };
  }

  // Check for quoted empty strings that slipped through
  if (value === '""' || value === "''") {
    return {
      isDangerous: true,
      kind: "dangerous_value",
      reason: `Value is an empty quoted string.`,
    };
  }

  // Check for common doc placeholder patterns
  // "your_..." is almost always a placeholder; "my_..." only with specific suffixes
  if (
    /^your[_-]/.test(lower) ||
    /^my[_-](secret|key|token|password|api)/i.test(lower) ||
    /[_-](here|todo|fixme|placeholder)$/.test(lower)
  ) {
    return {
      isDangerous: true,
      kind: "placeholder_value",
      reason: `"${value}" looks like a documentation placeholder.`,
    };
  }

  // Check for <angle bracket> placeholders like <your-key>
  if (/^<.+>$/.test(value)) {
    return {
      isDangerous: true,
      kind: "placeholder_value",
      reason: `"${value}" looks like a template placeholder.`,
    };
  }

  // For secret-like variable names, check if the value is suspiciously weak
  if (looksLikeSecretName(key)) {
    if (value.length > 0 && value.length < 8) {
      return {
        isDangerous: true,
        kind: "dangerous_value",
        reason: `Value is only ${value.length} characters. Secrets should be long and random.`,
      };
    }
  }

  return NOT_DANGEROUS;
}
