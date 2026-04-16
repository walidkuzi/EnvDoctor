# env-doctor

Diagnose `.env` issues in seconds. Scan your code, apply safe fixes, and wire env-doctor into your git hooks.

## Why

You cloned a repo, copied `.env.example` to `.env`, and the app still doesn't work. Something is missing, empty, or wrong — but the error message doesn't tell you what.

**env-doctor** reads your `.env` and `.env.example`, compares them, validates types, catches weak secrets, scans your source code for `process.env.KEY` usage, and can even patch your `.env` for you. It works with zero config and supports CI pipelines out of the box.

## What's new in v0.3

- **`env-doctor scan`** — walks your source tree and finds `process.env.*` / `import.meta.env.*` usage. Flags keys used in code but missing from `.env.example`, defined keys that are never referenced, and high-similarity typos.
- **`env-doctor fix`** — safe auto-remediation. Dry-run by default, creates a backup before writing, and refuses to overwrite non-empty values unless you pass `--force-overwrite`.
- **`env-doctor hooks install`** — one-command git hook setup. Detects husky / simple-git-hooks and wires `env-doctor check` into your pre-commit or pre-push stage.
- **Stable JSON schema** (`schemaVersion: "1.0.0"`) across every command. See [JSON schema](#json-schema).

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

# Scan your code for env usage and catch typos
npx env-doctor scan

# Dry-run the safe auto-fixer
npx env-doctor fix

# Write the fixes (with backup)
npx env-doctor fix --apply

# Install env-doctor as a pre-commit hook
npx env-doctor hooks install

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

## v0.3 workflow

The recommended flow for a new or existing project:

```bash
# 1. Get an env-doctor.json seed config
npx env-doctor init

# 2. Find any env keys your code uses that aren't in .env.example yet
npx env-doctor scan

# 3. Patch your local .env with missing keys and normalized values
npx env-doctor fix --apply

# 4. Wire env-doctor into your pre-commit hook so it stays green
npx env-doctor hooks install

# 5. Add `npx env-doctor ci` to CI
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

### `env-doctor scan`

Walks your source tree and finds env keys referenced in code. Compares them against `.env.example` to catch:

- **Used but undefined** (error) — your code reads a key that isn't in `.env.example`.
- **Defined but unused** (warning) — a key in `.env.example` is never referenced.
- **Potential typos** (warning) — a key used in code that's a near-match for a defined key.

```bash
npx env-doctor scan
```

```
Scanned 42 file(s), found 7 env key(s) in code.

✖ Used but undefined (1)
  ─ STRIPE_SECRET_KEY
    src/billing.ts:12
    Add STRIPE_SECRET_KEY to .env.example so teammates know it's required.

⚠ Potential typos (1)
  ─ DATABSE_URL → DATABASE_URL (score 0.92)
    src/config.ts:7

⚠ Defined but unused (1)
  ─ LEGACY_TOKEN

Summary: 1 error, 2 warnings
```

Supported source patterns: `process.env.KEY`, `process.env["KEY"]`, `process?.env?.KEY`, `import.meta.env.KEY`, `import.meta.env["KEY"]`. Default scan paths: `src`, `app`, `pages`, `server`, `lib`, `packages`. Default extensions: `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`.

| Flag | Description |
|---|---|
| `--paths <comma-separated>` | Override default scan paths |
| `--include <patterns>` | Comma-separated include patterns |
| `--exclude <patterns>` | Comma-separated exclude patterns |
| `--min-typo-score <0-1>` | Similarity threshold for typo detection (default `0.82`) |

### `env-doctor fix`

Apply safe, guided fixes to your `.env` file. **Dry-run by default** — pass `--apply` to write changes.

```bash
# Show what would change
npx env-doctor fix

# Actually write the fixes (creates .env.bak.<timestamp>)
npx env-doctor fix --apply
```

```
Dry run — 3 fix(es) planned:
  Run with --apply to write changes.

  ─ Add missing key DATABASE_URL
    + DATABASE_URL=__REPLACE_ME__
  ─ Add missing key STRIPE_SECRET_KEY
    + STRIPE_SECRET_KEY=__REPLACE_ME__
  ─ Normalize DEBUG to canonical boolean
    - DEBUG=yes
    + DEBUG=true
```

**Fix categories:**

1. Add missing keys from `.env.example` to `.env`.
2. Normalize boolean values (`yes/no/1/0/TRUE`) to canonical `true|false` for keys typed as boolean.
3. Trim whitespace in numeric/port values.
4. Replace dangerous placeholder values with the configured marker (default: `__REPLACE_ME__`).
5. Optionally remove keys that aren't in `.env.example` (`--remove-unused`).
6. Optionally drive fixes from a source-code scan (`--from-scan`).

**Safety:**

- Never overwrites a non-empty value unless you pass `--force-overwrite`.
- Always creates a backup (`.env.bak.<timestamp>`) before mutation, unless `--no-backup`.

| Flag | Description |
|---|---|
| `--apply` | Actually write changes (default is dry-run) |
| `--yes` | Skip interactive confirmations |
| `--remove-unused` | Remove keys not present in `.env.example` |
| `--from-scan` | Use scan results to drive fixes (adds used-but-undefined keys) |
| `--force-overwrite` | Allow overwriting non-empty values |
| `--no-backup` | Skip `.env` backup |
| `--placeholder-policy <empty\|example\|todo>` | How to fill missing values (default `todo`) |

### `env-doctor hooks install`

Install env-doctor into your git hook tooling. Detects existing config and merges non-destructively.

```bash
npx env-doctor hooks install                 # auto-detect tool, pre-commit
npx env-doctor hooks install --tool husky    # force husky
npx env-doctor hooks install --stage both    # pre-commit + pre-push
npx env-doctor hooks install --dry-run       # preview without writing
```

| Flag | Description |
|---|---|
| `--tool <auto\|husky\|simple-git-hooks\|lefthook>` | Hook tool (default `auto`) |
| `--stage <pre-commit\|pre-push\|both>` | Hook stage (default `pre-commit`) |
| `--command "<cmd>"` | Command to run in the hook (default `npx env-doctor check`) |
| `--dry-run` | Show planned changes without writing |
| `--yes` | Skip interactive confirmations |

env-doctor never installs npm packages for you — it only edits files for tools you already have. If your tool isn't installed or supported (currently lefthook prints manual instructions), you'll get a clear error with copy-pasteable manual steps.

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

## JSON schema

Add `--json` to any command for machine-readable output. Every command emits the same stable envelope, versioned with `schemaVersion`.

```bash
npx env-doctor check --json
```

```json
{
  "schemaVersion": "1.0.0",
  "toolVersion": "0.3.0",
  "command": "check",
  "ok": false,
  "timestamp": "2026-04-10T16:30:01.338Z",
  "project": {
    "root": "/path/to/your/project",
    "framework": "unknown"
  },
  "issues": [
    {
      "code": "MISSING",
      "kind": "missing",
      "severity": "error",
      "key": "DATABASE_URL",
      "message": "DATABASE_URL is missing from your .env file.",
      "hint": "Add it to your .env file.",
      "example": "DATABASE_URL=postgres://user:pass@localhost:5432/app"
    }
  ],
  "actions": [],
  "summary": {
    "errors": 1,
    "warnings": 0,
    "infos": 0,
    "totalIssues": 1
  },
  "exitCode": 1
}
```

### Top-level fields

| Field | Type | Description |
|---|---|---|
| `schemaVersion` | string | Stable schema version. Bumps only on breaking field changes. |
| `toolVersion` | string | The env-doctor version that produced this output. |
| `command` | string | The subcommand that was invoked (e.g. `"check"`, `"scan"`, `"fix"`). |
| `ok` | boolean | `true` iff there are no `error`-severity issues. |
| `timestamp` | string | ISO-8601 timestamp. |
| `project.root` | string | Absolute path to the project root. |
| `project.framework` | string | `"nextjs"`, `"vite"`, `"none"`, or `"unknown"`. |
| `issues[]` | array | Detected issues. See [issue codes](#issue-codes). |
| `actions[]` | array | Planned or applied mutations (used by `fix` and `hooks install`). |
| `summary` | object | `{ errors, warnings, infos, totalIssues }` |
| `exitCode` | number | The process exit code that env-doctor will use. |
| `data` | object? | Command-specific extra fields. |

### Issue codes

Stable, machine-actionable codes you can switch on:

| Code | Source command | Severity |
|---|---|---|
| `MISSING` | check, ci | error |
| `EXTRA` | check, ci | info |
| `EMPTY` | check, ci | warning |
| `INVALID_TYPE` | check, validate | warning |
| `INVALID_ENUM` | check, validate | warning |
| `DANGEROUS_VALUE` | check | warning |
| `PLACEHOLDER_VALUE` | check | warning |
| `FRAMEWORK_WARNING` | check | warning/info |
| `PARSE_WARNING` | check | warning |
| `USED_BUT_UNDEFINED` | scan | error |
| `DEFINED_BUT_UNUSED` | scan | warning |
| `POTENTIAL_TYPO` | scan | warning |
| `FIX_APPLIED` / `FIX_SKIPPED` | fix | info / warning |
| `HOOK_INSTALLED` / `HOOK_ALREADY_PRESENT` / `HOOK_UNSUPPORTED_TOOL` | hooks install | info / info / error |

### Backward compatibility

The v0.3 envelope is a **strict superset** of the v0.2 JSON shape. The `version`, `summary` (with `total`/`valid`), and command-specific top-level fields (e.g. `onlyInExample`, `keys`, `matrix`) from v0.2 are still emitted alongside the new envelope fields.

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

222 tests covering parsing, validation, type inference, analysis, dangerous value detection, framework heuristics, multi-env comparison, explain logic, config loading, the scanner, the fixer, hook installation, the unified JSON schema, and CLI commands.

## Roadmap

Shipped in v0.3:

- ✅ Source code scanning for used variables (`scan`)
- ✅ Safe auto-fixer (`fix`)
- ✅ Git hook integration (`hooks install`)
- ✅ Stable JSON schema contract

Future ideas for v0.4+:

- Scanner support for destructuring (`const { KEY } = process.env`)
- Interactive `init` with guided prompts
- SARIF export for CI annotations
- `fix --write-contract` to sync `.env.example` from scanned usage
- VS Code extension
- Plugin system for custom frameworks

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT
