# Explicit Blog Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit-front-matter tag library and SVG navigation while keeping the project and runtime architecture minimal.

**Architecture:** Extend only the existing generator data, routing, UI, CSS, and integration tests; create no tag-specific runtime modules. Markdown remains in `blog/`, the generator remains in `generator/`, and the existing Pages workflow remains unchanged.

**Tech Stack:** TypeScript, React 19, Vite 7, Unified/Remark, Node test runner, GitHub Actions, GitHub Pages

**Spec:** `docs/superpowers/specs/2026-10-26-tags-navigation-design.md`

## Global Constraints

- Tags come only from explicit Markdown `tags` front matter; never infer tags.
- Preserve `/blog/<slug>/`, Git-derived dates, search, theme, RSS, sitemap, and `mineguai.com`.
- Use only `tags` terminology; never restore clues/evidence/dossier names.
- Do not add new runtime source files; modify the existing focused files.
- Header tool order is search SVG, tag SVG, theme SVG, with no centered `博客` text.

## Review Focus

- Posts with no `tags` stay valid and do not create sample tags.
- `AI` and `ai` aggregate into one tag while preserving the first published display spelling.
- Duplicate tags inside one post count that post once.
- Chinese and space-containing tags produce stable encoded routes.
- Draft posts do not contribute tags to the published tag library.

---

### Task 1: Generate Explicit Tag Data and Routes

**Files:**
- Modify: `generator/src/types.ts`
- Modify: `generator/src/routes.ts`
- Modify: `generator/scripts/build.ts`
- Modify: `generator/tests/build-integration.test.ts`

**Interfaces:**
- Produces: `TagSummary { slug: string; name: string; count: number }`, `PostMeta.tags: string[]`, `SiteData.tags: TagSummary[]`
- Produces: `/tags/` and `/tags/<slug>/` routes from published explicit tags

- [ ] Add failing integration cases for no tags, case-insensitive aggregation, per-post de-duplication, Chinese tag routes, draft exclusion, sitemap routes, and no inferred tags.
- [ ] Run the focused integration test and confirm it fails on missing tag routes/data.
- [ ] Extend current types, Markdown loading, route generation, SEO titles, sitemap, and search payload with explicit tags only.
- [ ] Run integration tests, full tests, typecheck, and build; expect all green.
- [ ] Commit tag data and route generation.

### Task 2: Add Minimal Tag UI and Header SVG

**Files:**
- Modify: `generator/src/App.tsx`
- Modify: `generator/src/content-utils.ts`
- Modify: `generator/src/styles.css`
- Modify: `generator/tests/build-integration.test.ts`

**Interfaces:**
- Consumes: `SiteData.tags`, post `meta.tags`, and tag routes from Task 1
- Produces: tag index, filtered tag page, article tag links, tag-aware search, and accessible header tag SVG

- [ ] Add failing generated-HTML assertions for no centered blog nav, exact SVG order, `/tags/` content/counts, article tag links, filtered post lists, tag-aware search payload, and empty state.
- [ ] Run focused tests and verify the expected failures.
- [ ] Remove the centered navigation element; render tools as search, tag link, theme.
- [ ] Implement the tag index/page/article links/search with existing components and minimal CSS.
- [ ] Run all tests, typecheck, build, and Playwright checks for desktop/mobile navigation and tag filtering.
- [ ] Commit the UI.

### Task 3: Deploy and Verify

**Files:**
- No new files

**Interfaces:**
- Consumes: existing `.github/workflows/deploy-pages.yml`
- Produces: verified live tags on `mineguai.com`

- [ ] Push `main` and wait for the Pages workflow to succeed.
- [ ] Verify HTTPS homepage, SVG order, `/tags/`, a tag detail route, article tag links, and unchanged `/blog/hello/`.
- [ ] Verify Git status clean, local/remote heads match, legacy routes remain 404, and no new top-level architecture was introduced.

