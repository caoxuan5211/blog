import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

export type GitDates = {
  published: string;
  modified: string;
  commitCount: number;
};

const execFileAsync = promisify(execFile);

export const readGitDates = async (repoRoot: string, absoluteFile: string): Promise<GitDates> => {
  const relativeFile = path.relative(repoRoot, absoluteFile).replace(/\\/g, "/");
  if (!relativeFile || relativeFile.startsWith("../") || path.isAbsolute(relativeFile)) {
    throw new Error(`Post must be inside the repository: ${absoluteFile}`);
  }

  let history: string[] = [];
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", repoRoot, "log", "--follow", "--format=%aI", "--", relativeFile],
      { encoding: "utf8", maxBuffer: 1024 * 1024 }
    );
    history = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  } catch {
    history = [];
  }

  if (history.length > 0) {
    return {
      published: history.at(-1)!,
      modified: history[0],
      commitCount: history.length
    };
  }

  const fileStat = await stat(absoluteFile);
  return {
    published: (fileStat.birthtimeMs > 0 ? fileStat.birthtime : fileStat.mtime).toISOString(),
    modified: fileStat.mtime.toISOString(),
    commitCount: 0
  };
};
