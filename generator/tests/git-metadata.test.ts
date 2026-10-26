import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readGitDates } from "../scripts/git-metadata";

const git = (repo: string, args: string[], date?: string) => {
  execFileSync("git", ["-C", repo, ...args], {
    env: date
      ? { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }
      : process.env,
    stdio: "pipe"
  });
};

const createRepo = async (t: test.TestContext) => {
  const repo = await mkdtemp(path.join(os.tmpdir(), "mineguai-git-dates-"));
  t.after(() => rm(repo, { recursive: true, force: true }));
  git(repo, ["init", "-b", "main"]);
  git(repo, ["config", "user.name", "Test Author"]);
  git(repo, ["config", "user.email", "test@example.com"]);
  return repo;
};

const commitAll = (repo: string, message: string, date: string) => {
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-m", message], date);
};

test("one commit is both the publication and modification time", async (t) => {
  const repo = await createRepo(t);
  const file = path.join(repo, "blog", "hello.md");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, "# Hello\n");
  commitAll(repo, "add hello", "2026-10-01T08:00:00+08:00");

  assert.deepEqual(await readGitDates(repo, file), {
    published: "2026-10-01T08:00:00+08:00",
    modified: "2026-10-01T08:00:00+08:00",
    commitCount: 1
  });
});

test("multiple commits preserve the first date and expose the latest date", async (t) => {
  const repo = await createRepo(t);
  const file = path.join(repo, "blog", "hello.md");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, "# Hello\n");
  commitAll(repo, "add hello", "2026-10-01T08:00:00+08:00");
  await writeFile(file, "# Hello\n\nUpdated.\n");
  commitAll(repo, "update hello", "2026-10-08T09:30:00+08:00");

  assert.deepEqual(await readGitDates(repo, file), {
    published: "2026-10-01T08:00:00+08:00",
    modified: "2026-10-08T09:30:00+08:00",
    commitCount: 2
  });
});

test("renaming a post follows history back to its original publication", async (t) => {
  const repo = await createRepo(t);
  const original = path.join(repo, "blog", "old-name.md");
  const renamed = path.join(repo, "blog", "new-name.md");
  await mkdir(path.dirname(original), { recursive: true });
  await writeFile(original, "# Renamed\n");
  commitAll(repo, "add original", "2026-09-01T10:00:00+08:00");
  await rename(original, renamed);
  commitAll(repo, "rename post", "2026-10-09T11:00:00+08:00");

  assert.deepEqual(await readGitDates(repo, renamed), {
    published: "2026-09-01T10:00:00+08:00",
    modified: "2026-10-09T11:00:00+08:00",
    commitCount: 2
  });
});

test("Unicode paths are passed to Git without shell quoting loss", async (t) => {
  const repo = await createRepo(t);
  const file = path.join(repo, "blog", "中文文章.md");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, "# 中文文章\n");
  commitAll(repo, "add Chinese post", "2026-10-10T12:00:00+08:00");

  const dates = await readGitDates(repo, file);
  assert.equal(dates.published, "2026-10-10T12:00:00+08:00");
  assert.equal(dates.commitCount, 1);
});

test("an untracked post falls back to its real filesystem timestamps", async (t) => {
  const repo = await createRepo(t);
  const file = path.join(repo, "blog", "draft.md");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, "# Draft\n");
  const fileStat = await stat(file);
  const expectedPublished = (fileStat.birthtimeMs > 0 ? fileStat.birthtime : fileStat.mtime).toISOString();

  assert.deepEqual(await readGitDates(repo, file), {
    published: expectedPublished,
    modified: fileStat.mtime.toISOString(),
    commitCount: 0
  });
});
