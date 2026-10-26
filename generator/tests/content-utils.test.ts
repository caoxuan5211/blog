import assert from "node:assert/strict";
import test from "node:test";
import { formatDate, formatPostDates } from "../src/content-utils";

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
