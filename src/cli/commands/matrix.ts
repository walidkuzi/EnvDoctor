import { parseEnvContent } from "../../parser/index.js";
import { buildMultiEnvMatrix, getEnvFileList } from "../../core/index.js";
import { loadConfig } from "../../config/index.js";
import { renderMatrix, renderJSONMatrix } from "../../reporter/index.js";
import { readFileOrNull } from "../../utils/index.js";
import { EXIT_OK, EXIT_ERROR } from "../../types.js";
import type { CommandOptions } from "../options.js";
import type { ParseResult } from "../../types.js";

export function matrixCommand(cwd: string, opts: CommandOptions = {}): number {
  let config = null;
  try {
    config = loadConfig(cwd, opts.config);
  } catch (err) {
    console.error((err as Error).message);
    return EXIT_ERROR;
  }

  const fileList = getEnvFileList(config?.files);
  const files = new Map<string, ParseResult>();

  for (const filename of fileList) {
    const content = readFileOrNull(cwd, filename);
    if (content !== null) {
      files.set(filename, parseEnvContent(content));
    }
  }

  if (files.size === 0) {
    console.error(
      "No environment files found.\n" +
        "Looked for: " + fileList.join(", "),
    );
    return EXIT_ERROR;
  }

  const result = buildMultiEnvMatrix({ files });

  if (opts.json) {
    console.log(renderJSONMatrix(result, { root: cwd, exitCode: EXIT_OK }));
  } else {
    console.log(renderMatrix(result));
  }

  return EXIT_OK;
}
