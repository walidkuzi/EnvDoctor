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
  "replace_me",
  "todo",
  "fixme",
  "xxx",
  "test",
  "default",
  "example",
  "placeholder",
  "jwt_secret",
  "my_secret",
  "mysecret",
  "abc123",
  "qwerty",
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
];

function looksLikeSecretName(key: string): boolean {
  const upper = key.toUpperCase();
  return SECRET_NAME_PATTERNS.some((pattern) => upper.includes(pattern));
}

export interface DangerousCheck {
  isDangerous: boolean;
  reason?: string;
}

export function checkDangerousValue(
  key: string,
  value: string,
  customDangerousValues?: string[],
): DangerousCheck {
  const lower = value.toLowerCase().trim();
  const allDangerous = customDangerousValues
    ? [...DEFAULT_DANGEROUS_VALUES, ...customDangerousValues.map((v) => v.toLowerCase())]
    : DEFAULT_DANGEROUS_VALUES;

  // Check if value is a known dangerous/placeholder value
  if (allDangerous.includes(lower)) {
    return {
      isDangerous: true,
      reason: `"${value}" looks like a placeholder or default value.`,
    };
  }

  // For secret-like variable names, check if the value is suspiciously weak
  if (looksLikeSecretName(key)) {
    if (value.length > 0 && value.length < 8) {
      return {
        isDangerous: true,
        reason: `Value is only ${value.length} characters. Secrets should be long and random.`,
      };
    }
  }

  return { isDangerous: false };
}
