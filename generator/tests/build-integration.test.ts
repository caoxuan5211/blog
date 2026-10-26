import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const generatorRoot = path.resolve(import.meta.dirname, "..");
const distDir = path.join(generatorRoot, "dist");

const git = (repo: string, args: string[], date?: string) => {
  execFileSync("git", ["-C", repo, ...args], {
    env: date
      ? { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }
      : process.env,
    stdio: "pipe"
  });
};

const createContentRepo = async (t: test.TestContext) => {
  const repo = await mkdtemp(path.join(os.tmpdir(), "mineguai-build-"));
  const blog = path.join(repo, "blog");
  await mkdir(blog, { recursive: true });
  t.after(() => rm(repo, { recursive: true, force: true }));
  git(repo, ["init", "-b", "main"]);
  git(repo, ["config", "user.name", "Test Author"]);
  git(repo, ["config", "user.email", "test@example.com"]);
  return { repo, blog };
};

const runBuild = (repo: string, blog: string) => {
  execFileSync(process.execPath, ["--import", "tsx", "scripts/build.ts"], {
    cwd: generatorRoot,
    env: { ...process.env, BLOG_REPO_ROOT: repo, BLOG_CONTENT_DIR: blog },
    stdio: "pipe"
  });
};

test("an empty blog still produces the site shell, RSS, and sitemap", async (t) => {
  const { repo, blog } = await createContentRepo(t);

  runBuild(repo, blog);

  assert.match(await readFile(path.join(distDir, "index.html"), "utf8"), /<title>soken<\/title>/);
  const home = await readFile(path.join(distDir, "index.html"), "utf8");
  assert.match(home, /<button class="tool-button tool-button--search"[^>]*aria-label="搜索"><svg/);
  assert.doesNotMatch(home, /tool-button--search"[^>]*><span>搜索<\/span>/);
  assert.match(await readFile(path.join(distDir, "rss.xml"), "utf8"), /<channel>/);
  assert.match(await readFile(path.join(distDir, "sitemap.xml"), "utf8"), /https:\/\/mineguai\.com\//);
  assert.equal(await readFile(path.join(distDir, "sitemap.xml"), "utf8").then((text) => /evidence|dossier|clues/.test(text)), false);
});

test("plain Unicode Markdown with optional front matter builds a routed article", async (t) => {
  const { repo, blog } = await createContentRepo(t);
  const file = path.join(blog, "中文文章.md");
  await writeFile(file, "---\ntags: [笔记]\n---\n# 中文标题\n\n正文内容。\n");
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-m", "add post"], "2026-10-12T12:00:00+08:00");
  await writeFile(file, "---\ntags: [笔记]\n---\n# 中文标题\n\n正文内容。\n\n补充内容。\n");
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-m", "update post"], "2026-10-20T18:30:00+08:00");

  runBuild(repo, blog);

  const article = await readFile(path.join(distDir, "blog", "中文文章", "index.html"), "utf8");
  assert.match(article, /<h1>中文标题<\/h1>/);
  assert.doesNotMatch(article, /<h2>中文标题<\/h2>/);
  assert.match(article, /https:\/\/mineguai\.com\/blog\/%E4%B8%AD%E6%96%87%E6%96%87%E7%AB%A0\//);
  assert.match(article, /<time dateTime="2026-10-12T12:00:00\+08:00">发布于 (?:<!-- -->)?2026\/10\/12<\/time>/);
  assert.match(article, /<time dateTime="2026-10-20T18:30:00\+08:00">修改于 (?:<!-- -->)?2026\/10\/20<\/time>/);
  assert.match(
    await readFile(path.join(distDir, "index.html"), "utf8"),
    /<time dateTime="2026-10-12T12:00:00\+08:00">2026\/10\/12<\/time>/
  );
  const sitemap = await readFile(path.join(distDir, "sitemap.xml"), "utf8");
  assert.doesNotMatch(sitemap, /evidence|dossier|clues/);
});
