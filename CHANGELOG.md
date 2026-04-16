# Changelog

All notable changes to env-doctor are documented in this file.

The format is loosely based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.3.0] — 2026-04

### Added

- **`env-doctor scan`** — walks your source tree and finds env keys referenced in code (`process.env.*`, `import.meta.env.*`, bracket and optional-chain forms). Flags used-but-undefined keys (error), defined-but-unused keys (warning), and potential typos using Levenshtein similarity.
  - Options: `--paths`, `--include`, `--exclude`, `--min-typo-score`.
  - Default scan paths: `src`, `app`, `pages`, `server`, `lib`, `packages`. Default extensions: `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`.
- **`env-doctor fix`** — safe auto-remediation. Dry-run by default; pass `--apply` to write. Creates a timestamped backup (`.env.bak.<ts>`) before mutation.
  - Fix categories: add missing keys, normalize booleans, trim numeric whitespace, replace dangerous placeholders, optional `--remove-unused`, optional `--from-scan`.
  - Never overwrites a non-empty value unless `--force-overwrite` is passed.
  - Configurable placeholder policy via `--placeholder-policy <empty|example|todo>` (default `todo` → inserts `__REPLACE_ME__`).
- **`env-doctor hooks install`** — installs env-doctor into your git hook tooling.
  - Supports `--tool <auto|husky|simple-git-hooks|lefthook>`, `--stage <pre-commit|pre-push|both>`, `--command`, `--dry-run`.
  - Auto-detects installed tooling via `package.json` deps. Non-destructive edits. Clear manual-install fallback when auto-install isn't supported (e.g. lefthook in v0.3).
- **Stable JSON schema (`schemaVersion: "1.0.0"`)** for every command's `--json` output. New top-level envelope fields: `schemaVersion`, `toolVersion`, `timestamp`, `project.{root,framework}`, `issues[].code`, `issues[].location`, `actions[]`, `exitCode`.
- Stable machine-actionable `IssueCode` enum: `MISSING`, `EXTRA`, `EMPTY`, `INVALID_TYPE`, `INVALID_ENUM`, `DANGEROUS_VALUE`, `PLACEHOLDER_VALUE`, `FRAMEWORK_WARNING`, `PARSE_WARNING`, `USED_BUT_UNDEFINED`, `DEFINED_BUT_UNUSED`, `POTENTIAL_TYPO`, `FIX_APPLIED`, `FIX_SKIPPED`, `HOOK_INSTALLED`, `HOOK_ALREADY_PRESENT`, `HOOK_UNSUPPORTED_TOOL`.

### Changed

- Bumped version to `0.3.0`.
- All JSON-emitting commands (`check`, `ci`, `diff`, `validate`, `explain`, `matrix`) now emit the unified envelope. The v0.2 legacy top-level fields (`version`, command-specific data like `onlyInExample`, `keys`, `matrix`) are still emitted for backward compatibility.
- `check`/`ci` JSON now correctly reports `exitCode` taking `--fail-on-warning` into account.

### Internal

- New modules: `src/output/`, `src/scanner/`, `src/fixer/`, `src/hooks/`.
- New example fixture `examples/scan-project/` with source files that exercise the scanner.
- Test count grew from 144 → 222. New test files: `scanner.test.ts`, `fixer.test.ts`, `hooks.test.ts`, `schema.test.ts`, `v03-commands.test.ts`.

### Known limitations (deferred to v0.4)

- The scanner uses regex-based extraction rather than a full AST; destructuring (`const { KEY } = process.env`) and dynamic bracket access (`process.env[someVar]`) are not detected.
- `hooks install` for lefthook is planning-only — it prints manual instructions rather than writing `lefthook.yml`.
- `fix` preserves comments and ordering of the existing `.env` file for in-place updates and removals, but new keys are appended to the end rather than merged thematically.
- No `--sarif` export yet (stretch goal for v0.4).

## [0.2.0]

- Type inference, validation, framework awareness, matrix, explain, CI, and init commands.

## [0.1.0]

- Initial release.
