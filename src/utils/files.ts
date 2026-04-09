import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export function readFileOrNull(cwd: string, filename: string): string | null {
  const filePath = resolve(cwd, filename);
  if (!existsSync(filePath)) {
    return null;
  }
  return readFileSync(filePath, "utf-8");
}
