import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { scanCommand } from "../src/cli/commands/scan.js";
import { fixCommand } from "../src/cli/commands/fix.js";
import { hooksInstallCommand } from "../src/cli/commands/hooks.js";
import { EXIT_OK, EXIT_ISSUES, EXIT_ERROR } from "../src/types.js";

const SCAN_FIXTURE = resolve(import.meta.dirname, "../examples/scan-project");

let workDir: string;
let logs: string[];

function captureLogs(): void {
  logs = [];
  vi.spyOn(console, "log").mockImplementation((...args) => {
    logs.push(args.join(" "));
  });
  vi.spyOn(console, "error").mockImplementation((...args) => {
    logs.push(args.join(" "));
  });
}

function restoreLogs(): void {
  vi.restoreAllMocks();
}

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), "env-doctor-v03-"));
  captureLogs();
});

afterEach(() => {
  restoreLogs();
  rmSync(workDir, { recursive: true, force: true });
});

function write(name: string, content: string): void {
  writeFileSync(join(workDir, name), content, "utf-8");
}

function read(name: string): string {
  return readFileSync(join(workDir, name), "utf-8");
}

// ---------------------- scan ----------------------

describe("scan command", () => {
  it("returns 0 when there are no issues (no source files)", () => {
    write(".env.example", "FOO=1\n");
    write(".env", "FOO=1\n");
    expect(scanCommand(workDir)).toBe(EXIT_OK);
  });

  it("returns 1 when there are used-but-undefined keys", () => {
    mkdirSync(join(workDir, "src"));
    writeFileSync(
      join(workDir, "src/index.ts"),
      "const x = process.env.NOT_IN_CONTRACT;",
    );
    write(".env.example", "FOO=1\n");
    expect(scanCommand(workDir)).toBe(EXIT_ISSUES);
  });

  it("rejects an invalid --min-typo-score", () => {
    write(".env.example", "FOO=1\n");
    expect(scanCommand(workDir, { minTypoScore: "not-a-number" })).toBe(
      EXIT_ERROR,
    );
  });

  it("emits a valid envelope in --json mode", () => {
    write(".env.example", "FOO=1\n");
    scanCommand(workDir, { json: true });
    const output = logs.join("\n");
    const parsed = JSON.parse(output);
    expect(parsed.schemaVersion).toBe("1.0.0");
    expect(parsed.command).toBe("scan");
    expect(parsed.project.root).toBe(workDir);
    expect(Array.isArray(parsed.issues)).toBe(true);
    expect(parsed.data).toBeDefined();
    expect(typeof parsed.data.filesScanned).toBe("number");
  });

  it("finds used/unused/typos on the scan-project fixture", () => {
    scanCommand(SCAN_FIXTURE, { json: true });
    const parsed = JSON.parse(logs.join("\n"));
    const codes = parsed.issues.map((i: { code: string }) => i.code);
    expect(codes).toContain("DEFINED_BUT_UNUSED");
    expect(codes).toContain("USED_BUT_UNDEFINED");
    expect(codes).toContain("POTENTIAL_TYPO");
  });

  it("respects --paths override", () => {
    write(".env.example", "FOO=1\n");
    mkdirSync(join(workDir, "my-code"));
    writeFileSync(
      join(workDir, "my-code/foo.ts"),
      "const x = process.env.FOO;",
    );
    scanCommand(workDir, { json: true, paths: "my-code" });
    const parsed = JSON.parse(logs.join("\n"));
    expect(parsed.data.filesScanned).toBeGreaterThan(0);
  });
});

// ---------------------- fix ----------------------

describe("fix command", () => {
  it("dry-run by default — no file writes", () => {
    write(".env.example", "FOO=1\nBAR=2\n");
    write(".env", "FOO=1\n");
    const code = fixCommand(workDir);
    expect(code).toBe(EXIT_OK);
    expect(read(".env")).toBe("FOO=1\n");
  });

  it("--apply writes the .env file", () => {
    write(".env.example", "FOO=1\nBAR=2\n");
    write(".env", "FOO=1\n");
    fixCommand(workDir, { apply: true });
    expect(read(".env")).toContain("BAR=__REPLACE_ME__");
  });

  it("--json emits envelope with actions array", () => {
    write(".env.example", "FOO=1\nBAR=2\n");
    write(".env", "FOO=1\n");
    fixCommand(workDir, { json: true });
    const parsed = JSON.parse(logs.join("\n"));
    expect(parsed.schemaVersion).toBe("1.0.0");
    expect(parsed.command).toBe("fix");
    expect(parsed.actions.length).toBeGreaterThan(0);
    expect(parsed.data.mode).toBe("dry-run");
  });

  it("rejects invalid --placeholder-policy", () => {
    write(".env.example", "FOO=1\n");
    write(".env", "FOO=1\n");
    expect(fixCommand(workDir, { placeholderPolicy: "bogus" })).toBe(
      EXIT_ERROR,
    );
  });

  it("errors when .env.example is missing and --from-scan not set", () => {
    write(".env", "FOO=1\n");
    expect(fixCommand(workDir)).toBe(EXIT_ERROR);
  });

  it("--apply creates a backup by default", () => {
    write(".env.example", "FOO=1\nBAR=2\n");
    write(".env", "FOO=1\n");
    fixCommand(workDir, { apply: true });
    // Check backup file exists
    const backups = (
      readFileSyncOrDir(workDir) as string[]
    ).filter((f) => f.startsWith(".env.bak."));
    expect(backups.length).toBeGreaterThan(0);
  });
});

function readFileSyncOrDir(dir: string): string[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("node:fs").readdirSync(dir);
}

// ---------------------- hooks install ----------------------

describe("hooks install command", () => {
  it("dry run makes no file writes", () => {
    writeFileSync(
      join(workDir, "package.json"),
      JSON.stringify({ devDependencies: { husky: "^8" } }),
    );
    hooksInstallCommand(workDir, { dryRun: true });
    expect(existsSync(join(workDir, ".husky", "pre-commit"))).toBe(false);
  });

  it("writes husky hook file on apply", () => {
    writeFileSync(
      join(workDir, "package.json"),
      JSON.stringify({ devDependencies: { husky: "^8" } }),
    );
    const code = hooksInstallCommand(workDir, { tool: "husky" });
    expect(code).toBe(EXIT_OK);
    expect(existsSync(join(workDir, ".husky", "pre-commit"))).toBe(true);
  });

  it("rejects an invalid --tool value", () => {
    expect(hooksInstallCommand(workDir, { tool: "weird" })).toBe(EXIT_ERROR);
  });

  it("rejects an invalid --stage value", () => {
    expect(hooksInstallCommand(workDir, { stage: "pre-merge" })).toBe(
      EXIT_ERROR,
    );
  });

  it("reports unsupported tool clearly", () => {
    writeFileSync(
      join(workDir, "package.json"),
      JSON.stringify({ devDependencies: {} }),
    );
    const code = hooksInstallCommand(workDir, { tool: "husky" });
    expect(code).toBe(EXIT_ERROR);
  });

  it("--json emits envelope with data.tool populated", () => {
    writeFileSync(
      join(workDir, "package.json"),
      JSON.stringify({ devDependencies: { "simple-git-hooks": "^2" } }),
    );
    hooksInstallCommand(workDir, {
      json: true,
      dryRun: true,
      tool: "simple-git-hooks",
    });
    const parsed = JSON.parse(logs.join("\n"));
    expect(parsed.schemaVersion).toBe("1.0.0");
    expect(parsed.command).toBe("hooks install");
    expect(parsed.data.tool).toBe("simple-git-hooks");
    expect(parsed.data.dryRun).toBe(true);
  });
});

// ---------------------- JSON schema consistency ----------------------

describe("unified JSON schema across commands", () => {
  const requiredFields = [
    "schemaVersion",
    "toolVersion",
    "command",
    "ok",
    "timestamp",
    "project",
    "issues",
    "actions",
    "summary",
    "exitCode",
  ] as const;

  it("scan emits all required envelope fields", () => {
    write(".env.example", "FOO=1\n");
    scanCommand(workDir, { json: true });
    const parsed = JSON.parse(logs.join("\n"));
    for (const f of requiredFields) {
      expect(parsed).toHaveProperty(f);
    }
  });

  it("fix emits all required envelope fields", () => {
    write(".env.example", "FOO=1\n");
    write(".env", "FOO=1\n");
    fixCommand(workDir, { json: true });
    const parsed = JSON.parse(logs.join("\n"));
    for (const f of requiredFields) {
      expect(parsed).toHaveProperty(f);
    }
  });

  it("hooks install emits all required envelope fields", () => {
    writeFileSync(
      join(workDir, "package.json"),
      JSON.stringify({ devDependencies: { husky: "^8" } }),
    );
    hooksInstallCommand(workDir, { json: true, dryRun: true });
    const parsed = JSON.parse(logs.join("\n"));
    for (const f of requiredFields) {
      expect(parsed).toHaveProperty(f);
    }
  });
});
