import assert from "node:assert/strict";
import test from "node:test";
import { dedupeTags, formatDate, formatPostDates, normalizeTagSlug, summarizeTags } from "../src/content-utils";

test("a one-commit post exposes only its publication label", () => {
  assert.deepEqual(
    formatPostDates("2026-10-26T08:00:00+08:00", "2026-10-26T08:00:00+08:00"),
    { published: "2026/10/26" }
  );
});

test("a later commit exposes both publication and modification labels", () => {
  assert.deepEqual(
    formatPostDates("2026-10-26T08:00:00+08:00", "2026-11-03T09:30:00+08:00"),
    { published: "2026/10/26", modified: "2026/11/03" }
  );
});

test("date formatting is pinned to Asia/Shanghai in UTC build environments", () => {
  assert.equal(formatDate("2026-10-25T16:30:00.000Z"), "2026/10/26");
});

test("tags are de-duplicated case-insensitively inside one post", () => {
  assert.deepEqual(dedupeTags(["AI", "ai", " LLM ", "llm"]), ["AI", "LLM"]);
});

test("tag summaries count each post once and preserve the oldest published spelling", () => {
  const tags = summarizeTags([
    { date: "2026-10-20T00:00:00Z", tags: ["ai", "AI", "LLM"] },
    { date: "2026-10-01T00:00:00Z", tags: ["AI", "健康 学习"] }
  ]);

  assert.deepEqual(tags.find((tag) => tag.slug === "ai"), { slug: "ai", name: "AI", count: 2 });
  assert.deepEqual(tags.find((tag) => tag.slug === "llm"), { slug: "llm", name: "LLM", count: 1 });
  assert.deepEqual(tags.find((tag) => tag.name === "健康 学习"), {
    slug: "%E5%81%A5%E5%BA%B7-%E5%AD%A6%E4%B9%A0",
    name: "健康 学习",
    count: 1
  });
  assert.equal(tags[0].slug, "ai");
});

test("an empty explicit tag list creates an empty library", () => {
  assert.deepEqual(summarizeTags([{ date: "2026-10-01T00:00:00Z", tags: [] }]), []);
});

test("tag slugs are stable for spaces, case, and Chinese text", () => {
  assert.equal(normalizeTagSlug("  Health Study  "), "health-study");
  assert.equal(normalizeTagSlug("健康 学习"), "%E5%81%A5%E5%BA%B7-%E5%AD%A6%E4%B9%A0");
});
