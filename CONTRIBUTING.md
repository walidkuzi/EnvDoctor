# Contributing to env-doctor

Thanks for your interest in contributing! This project is intentionally small and focused. Contributions that keep it simple, helpful, and beginner-friendly are very welcome.

## Getting started

```bash
git clone https://github.com/your-username/env-doctor.git
cd env-doctor
npm install
npm run build
npm test
```

## Development workflow

```bash
npm run dev      # Watch mode — rebuilds on file changes
npm test         # Run all tests
npm run lint     # Type-check without emitting
```

## Project structure

```
src/
  cli/           # Command definitions and CLI entry point
  config/        # Config file loading and validation
  core/          # Analysis engine, diff, explain, init, multi-env
  framework/     # Framework detection (Next.js, Vite)
  inference/     # Type inference from names and values
  parser/        # .env file parser
  reporter/      # Output formatting (pretty, CI, JSON)
  validators/    # Type validators (number, boolean, url, port, etc.)
  utils/         # File reading helpers
  types.ts       # All shared TypeScript types
tests/           # Test files (mirrors src/ structure)
examples/        # Fixture projects for testing and demos
```

## Design principles

- **Zero-config first**: The tool must work with just `.env` and `.env.example`.
- **Beginner-friendly output**: Every warning should explain what's wrong and how to fix it.
- **No false-positive explosions**: Heuristics should be conservative. Better to miss an edge case than to annoy users with noise.
- **Keep it small**: Minimal dependencies. No unnecessary abstractions.
- **Analysis and rendering are separate**: Core logic returns data. Reporters render it. This makes everything testable.

## Writing tests

Tests live in `tests/` and use [vitest](https://vitest.dev/). Aim for practical, readable tests.

```bash
npm test                # Run all tests once
npm run test:watch      # Re-run on changes
```

## Before submitting a PR

1. Run `npm run lint` (type-check)
2. Run `npm test` (all tests pass)
3. Keep changes focused — one feature or fix per PR
4. Update tests for any new behavior
5. Update README if adding user-facing features

## Code style

- TypeScript with strict mode
- ESM imports
- Prefer simple, explicit code over clever abstractions
- Use `picocolors` for terminal colors (not chalk)
- Messages should be calm, helpful, and plain-English
