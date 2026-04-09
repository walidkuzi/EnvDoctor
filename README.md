# env-doctor

Diagnose `.env` issues in seconds. Find missing, invalid, and insecure environment variables.

## Why

You cloned a repo, copied `.env.example` to `.env`, and the app still doesn't work. Something is missing, empty, or wrong — but the error message doesn't tell you what.

**env-doctor** reads your `.env` and `.env.example`, compares them, validates types, catches weak secrets, and tells you exactly what's wrong and how to fix it. It works with zero config and supports CI pipelines out of the box.

## Install

```bash
npm install -g env-doctor
```

Or run directly with npx:

```bash
npx env-doctor check
```

## Quick start

```bash
# Check your .env against .env.example
npx env-doctor check

# Generate a config file from .env.example
npx env-doctor init

# Understand a specific variable
npx env-doctor explain DATABASE_URL

# See which keys differ between files
npx env-doctor diff

# Compare variables across all env files
npx env-doctor matrix

# Validate value types
npx env-doctor validate

# Run in CI
npx env-doctor ci
```

## Commands

### `env-doctor check`

The main diagnostic command. Compares `.env` against `.env.example` and reports all issues.

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

⚠ Placeholder values
  ─ JWT_SECRET looks weak: "123".
    "123" looks like a placeholder or default value.

ℹ Extra variables
  ─ OLD_API_KEY exists in .env but not in .env.example.
    This may be intentional, or it could be a leftover variable.

Summary: 1 error, 3 warnings, 1 info
```

### `env-doctor init`

Generate an `env-doctor.json` config by analyzing your `.env.example`. Infers types, marks secrets as required, and sets up placeholder detection.

```bash
npx env-doctor init
```

```
✔ Generated env-doctor.json

  Detected 7 variables from .env.example
  Inferred 4 typed variables (1 enum, 3 others)
  Marked 2 variables as required

  Review env-doctor.json and adjust as needed.
  Then run: env-doctor check
```

Use `--yes` to overwrite an existing config.

### `env-doctor explain <variable>`

Understand a single variable — where it exists, what type it should be, and what's wrong.

```bash
npx env-doctor explain DATABASE_URL
```

```
Variable: DATABASE_URL

  In .env:         missing
  In .env.example: yes = "postgres://user:pass@localhost:5432/myapp"
  Required:        yes
  Expected type:   url (inferred)

  Issues:
    ⚠ DATABASE_URL is required but missing from your .env file.

  Suggestion: Add to your .env file: DATABASE_URL=postgres://user:pass@localhost:5432/myapp
```

If you mistype a variable name, env-doctor suggests the closest match.

### `env-doctor diff`

Compare keys between `.env` and `.env.example`.

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

### `env-doctor matrix`

Compare variables across all environment files (`.env`, `.env.example`, `.env.local`, `.env.production`, etc.).

```
Variable             .env             .env.example     .env.production
──────────────────────────────────────────────────────────────────────
DATABASE_URL         ✔                ✔                ✖
JWT_SECRET           ✔                ✔                ✖
NEXT_PUBLIC_APP_URL  ✔                ✔                ✔
NODE_ENV             ✔                ✔                ✔
PORT                 ✔                ✔                ✖

⚠ 3 variables missing from at least one file:
  ─ DATABASE_URL missing in .env.production
  ─ JWT_SECRET missing in .env.production
  ─ PORT missing in .env.production
```

### `env-doctor validate`

Validate values against expected types — inferred from `.env.example` or configured in `env-doctor.json`.

```
  ✔ APP_URL is a valid url
  ✔ PORT is a valid port
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

## Flags

These flags work across most commands:

| Flag | Description |
|---|---|
| `--json` | Output results as JSON (machine-readable) |
| `--quiet` | Suppress detailed output, show only summary |
| `--fail-on-warning` | Exit with code 1 on warnings (not just errors) |
| `--no-color` | Disable colored output |
| `--config <path>` | Path to a custom config file |
| `--env-file <path>` | Path to .env file (default: `.env`) |
| `--example-file <path>` | Path to .env.example file (default: `.env.example`) |

## Zero-config mode

env-doctor works without any configuration. It uses `.env.example` as the source of truth and infers types automatically.

### Type inference

Types are inferred from both **variable names** and **example values**:

| Signal | Inferred type |
|---|---|
| Name contains `PORT` or ends with `_PORT` | port |
| Name is `NODE_ENV`, `LOG_LEVEL`, etc. | enum |
| Name starts with `ENABLE_`, `IS_`, `DEBUG` | boolean |
| Name contains `_URL`, `_URI`, `_ENDPOINT` | url |
| Name contains `_EMAIL` | email |
| Value is `true`, `false`, `yes`, `no` | boolean |
| Value is a number (e.g. `3000`) | number |
| Value is a URL (e.g. `https://...`) | url |

### Supported types

| Type | Valid examples |
|---|---|
| `string` | Any non-empty string |
| `number` | `42`, `3.14`, `-1` |
| `boolean` | `true`, `false`, `1`, `0`, `yes`, `no` |
| `url` | `https://example.com`, `postgres://...`, `redis://...` |
| `port` | `1`–`65535` (integers only) |
| `email` | `user@example.com` |
| `enum` | One of a set of allowed values |

## Configuration

Create an optional `env-doctor.json` in your project root, or use `env-doctor init` to generate one.

```json
{
  "types": {
    "PORT": "port",
    "DEBUG": "boolean",
    "APP_URL": "url",
    "DATABASE_URL": "url",
    "NODE_ENV": {
      "type": "enum",
      "values": ["development", "test", "production"]
    }
  },
  "required": ["DATABASE_URL", "JWT_SECRET"],
  "dangerousValues": ["changeme", "password", "your_key_here"],
  "framework": "auto",
  "files": [".env", ".env.local", ".env.production"]
}
```

### Config reference

| Field | Type | Description |
|---|---|---|
| `types` | `Record<string, Type>` | Explicit type per variable. Overrides inference. |
| `required` | `string[]` | Additional required variables beyond `.env.example`. |
| `dangerousValues` | `string[]` | Custom values to flag as placeholder/dangerous. |
| `framework` | `"auto" \| "nextjs" \| "vite" \| "none"` | Framework detection mode. Default: `"auto"`. |
| `files` | `string[]` | Env files to include in `matrix` command. |

Types can be a simple string (`"number"`, `"url"`, `"port"`, `"boolean"`, `"email"`) or an enum object:

```json
{ "type": "enum", "values": ["development", "test", "production"] }
```

## Framework awareness

env-doctor auto-detects Next.js and Vite projects and provides framework-specific warnings:

**Next.js:**
```
⚠ NEXT_PUBLIC_API_KEY uses the NEXT_PUBLIC_ prefix, which exposes it to the browser in Next.js.
  Variables containing secrets should not use the NEXT_PUBLIC_ prefix.
```

**Vite:**
```
ℹ API_URL might need the VITE_ prefix to be accessible in Vite browser code.
  If this variable is used in the browser, rename it to VITE_API_URL.
```

Set `"framework": "none"` in config to disable these checks.

## JSON output

Add `--json` to any command for machine-readable output:

```bash
npx env-doctor check --json
```

```json
{
  "version": "0.2.0",
  "command": "check",
  "ok": false,
  "issues": [
    {
      "kind": "missing",
      "severity": "error",
      "key": "DATABASE_URL",
      "message": "DATABASE_URL is missing from your .env file.",
      "hint": "Add it to your .env file.",
      "example": "DATABASE_URL=postgres://user:pass@localhost:5432/app"
    }
  ],
  "summary": {
    "errors": 1,
    "warnings": 0,
    "infos": 0,
    "total": 5,
    "valid": 5
  }
}
```

## CI usage

### GitHub Actions

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: 20
  - name: Check environment variables
    run: npx env-doctor ci
```

### Fail on warnings too

```yaml
  - name: Strict env check
    run: npx env-doctor ci --fail-on-warning
```

### JSON output in CI

```yaml
  - name: Check env (JSON)
    run: npx env-doctor ci --json
```

## Exit codes

| Code | Meaning |
|---|---|
| `0` | No issues found |
| `1` | Validation or comparison issues found |
| `2` | Tool error (missing files, bad config) |

By default, only errors (severity `"error"`) cause exit code 1. Use `--fail-on-warning` to also fail on warnings.

## Local development

```bash
git clone https://github.com/your-username/env-doctor.git
cd env-doctor
npm install
npm run build
npm test
```

Run against the example fixtures:

```bash
cd examples/broken-project && node ../../dist/cli/index.js check
cd examples/nextjs-project && node ../../dist/cli/index.js check
```

Watch mode:

```bash
npm run dev        # Rebuild on changes
npm run test:watch # Re-run tests on changes
```

## Testing

```bash
npm test
```

144 tests covering parsing, validation, type inference, analysis, dangerous value detection, framework heuristics, multi-env comparison, explain logic, config loading, JSON output, and CLI commands.

## Roadmap

Phase 1 and Phase 2 are complete. Future ideas include:

- Interactive `init` with guided prompts
- Source code scanning for used variables
- Git hook integration
- Custom validation rules
- `.env` file generation from `.env.example`
- Plugin system for custom frameworks

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT
