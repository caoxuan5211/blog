import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { parsePostSource, slugifyPost } from "../scripts/content-source";

test("plain Markdown uses its first H1 as title and removes that duplicate heading", () => {
  const result = parsePostSource("Intro.\n\n# My title\n\nBody.\n", "fallback");

  assert.equal(result.title, "My title");
  assert.equal(result.body.trim(), "Intro.\n\nBody.");
  assert.doesNotMatch(result.body, /^#\s/m);
  assert.deepEqual(result.data, {});
});

test("optional front matter title wins while the body H1 is still removed", () => {
  const result = parsePostSource(
    "---\ntitle: Front matter title\ntags:\n  - notes\n---\n# Body title\n\nText.\n",
    "fallback"
  );

  assert.equal(result.title, "Front matter title");
  assert.equal(result.body.trim(), "Text.");
  assert.doesNotMatch(result.body, /^#\s/m);
  assert.deepEqual(result.data.tags, ["notes"]);
});

test("a post without an H1 falls back to its filename-derived title", () => {
  const result = parsePostSource("Paragraph only.\n", "plain-note");

  assert.equal(result.title, "plain-note");
  assert.equal(result.body, "Paragraph only.\n");
});

test("empty Markdown is a valid post source", () => {
  const result = parsePostSource("", "empty-post");

  assert.equal(result.title, "empty-post");
  assert.equal(result.body, "");
});

test("Unicode filenames produce stable URL-encoded slugs", () => {
  const contentDir = path.join("repo", "blog");
  const file = path.join(contentDir, "中文文章.md");

  assert.equal(slugifyPost(file, contentDir), "%E4%B8%AD%E6%96%87%E6%96%87%E7%AB%A0");
});
