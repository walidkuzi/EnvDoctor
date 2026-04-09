# env-doctor

Diagnose `.env` issues in seconds. Find missing, invalid, and insecure environment variables.

## Why

You cloned a repo, copied `.env.example` to `.env`, and the app still doesn't work. Something is missing, empty, or wrong — but the error message doesn't tell you what.

**env-doctor** reads your `.env` and `.env.example`, compares them, and tells you exactly what's wrong and how to fix it.

## Install

```bash
npm install -g env-doctor
```

Or run directly:

```bash
npx env-doctor check
```

## Quick Start

```bash
# Check your .env against .env.example
npx env-doctor check

# See which keys differ between files
npx env-doctor diff

# Validate value types
npx env-doctor validate

# Run in CI
npx env-doctor ci
```

## Commands

### `env-doctor check`

The main diagnostic command. Compares `.env` against `.env.example` and reports:

- **Missing variables** — in `.env.example` but not in `.env`
- **Extra variables** — in `.env` but not in `.env.example`
- **Empty values** — key exists but value is blank
- **Invalid values** — wrong type (e.g. `PORT=abc` when a number is expected)
- **Dangerous defaults** — weak secrets, placeholder values

Example output:

```
✖ Missing variables
  ─ DATABASE_URL is missing from your .env file.
    Add it to your .env file.
    Example: DATABASE_URL=postgres://user:pass@localhost:5432/app

⚠ Empty values
  ─ OPENAI_API_KEY is present but empty.
    Set a value for this variable in your .env file.

⚠ Invalid values
  ─ PORT should be a number, but found "abc".
    Set a valid number value.
    Example: PORT=3000

⚠ Dangerous defaults
  ─ JWT_SECRET looks weak: "123".
    "123" looks like a placeholder or default value.

ℹ Extra variables
  ─ OLD_API_KEY exists in .env but not in .env.example.
    This may be intentional, or it could be a leftover variable.

Summary: 1 error, 3 warnings, 1 info
```

### `env-doctor diff`

Side-by-side key comparison between `.env` and `.env.example`.

```
✖ Only in .env.example (missing from .env):
  + DATABASE_URL
  + STRIPE_SECRET_KEY

ℹ Only in .env (not in .env.example):
  − OLD_API_KEY

✔ In both files (5):
  = APP_NAME
  = APP_URL
  = PORT
  = DEBUG
  = JWT_SECRET
```

### `env-doctor validate`

Validates values against expected types (inferred from `.env.example` or configured in `env-doctor.json`).

```
  ✔ APP_URL is a valid url
  ✔ PORT is a valid number
  ✖ DEBUG should be a boolean, but found "maybe"
    Example: DEBUG=true

1 invalid value found.
```

### `env-doctor ci`

Same checks as `check`, with concise CI-friendly output and proper exit codes.

```
[ERROR] DATABASE_URL: DATABASE_URL is missing from your .env file.
[WARN] PORT: PORT should be a number, but found "abc".
[WARN] JWT_SECRET: JWT_SECRET looks weak: "123".

env-doctor: 1 error(s), 2 warning(s), 0 info(s)
```

## Zero-Config Mode

env-doctor works without any configuration. It uses `.env.example` as the source of truth and infers types from example values:

| Example value | Inferred type |
|---|---|
| `PORT=3000` | number |
| `DEBUG=true` | boolean |
| `APP_URL=https://example.com` | url |
| `APP_NAME=my-app` | string |

## Configuration

Create an optional `env-doctor.json` in your project root to customize behavior:

```json
{
  "types": {
    "PORT": "number",
    "DEBUG": "boolean",
    "APP_URL": "url",
    "DATABASE_URL": "url"
  },
  "required": ["DATABASE_URL", "JWT_SECRET"],
  "dangerousValues": ["your_key_here", "replace_me"]
}
```

### Config options

| Field | Type | Description |
|---|---|---|
| `types` | `Record<string, Type>` | Explicit type for variables. Overrides inference. |
| `required` | `string[]` | Additional required variables (beyond `.env.example`). |
| `dangerousValues` | `string[]` | Custom values to flag as dangerous/placeholder. |

Supported types: `string`, `number`, `boolean`, `url`.

Boolean values accepted: `true`, `false`, `1`, `0`, `yes`, `no`.

## CI Usage

Add to your GitHub Actions workflow:

```yaml
- name: Check environment variables
  run: npx env-doctor ci
```

Or in any CI pipeline:

```bash
npx env-doctor ci || exit 1
```

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | No issues found |
| `1` | Validation or comparison issues found |
| `2` | Tool error (missing files, bad config) |

## Local Development

```bash
git clone https://github.com/your-username/env-doctor.git
cd env-doctor
npm install
npm run build
```

Run against the example fixtures:

```bash
cd examples/valid-project && node ../../dist/cli/index.js check
cd examples/broken-project && node ../../dist/cli/index.js check
```

### Testing

```bash
npm test
```

### Building

```bash
npm run build
```

## Roadmap

Phase 1 (current) covers core diagnostics: parsing, comparison, type validation, dangerous default detection, pretty output, and CI mode.

More features are planned for future releases, including multi-environment support, framework intelligence, and interactive onboarding.

## License

MIT
