# Markdown Actions Blog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish plain `blog/*.md` files to the existing React blog automatically on every push, with Git-derived publication/modification dates, then remove all retired blog and Mahjong artifacts.

**Architecture:** Keep author content at repository root and isolate the existing static generator under `generator/`. A GitHub Pages Actions workflow checks out full Git history, tests and builds `generator/dist`, then deploys that artifact; legacy root output remains only until the first Actions deployment is verified.

**Tech Stack:** TypeScript, React 19, Vite 7, Unified/Remark/Rehype, Node test runner, GitHub Actions, GitHub Pages

**Spec:** `docs/superpowers/specs/2026-10-26-markdown-actions-blog-design.md`

## Global Constraints

- Daily authoring changes only `blog/*.md`; no local build is required.
- Deployed timestamps come from full Git history, not filesystem timestamps.
- Preserve the current UI and `https://mineguai.com`.
- Keep the live branch deployment intact until an Actions deployment is verified.
- Do not delete any backup or retired repository before migration verification.

## Review Focus

- A Markdown file with no front matter must build with a title and valid Git dates.
- A file renamed after publication must retain its original publication date.
- A file with one commit must not display a redundant modification date.
- An empty `blog/` directory must still generate a valid homepage, archive, search payload, RSS, and sitemap.
- Chinese filenames/headings and UTF-8 content must produce stable encoded routes.

---

### Task 1: Import the Generator Without Affecting the Live Root

**Files:**
- Create: `generator/package.json`
- Create: `generator/package-lock.json`
- Create: `generator/tsconfig.json`
- Create: `generator/vite.config.ts`
- Create: `generator/index.html`
- Create: `generator/src/**`
- Create: `generator/scripts/build.ts`
- Create: `generator/site-public/**`
- Create: `blog/.gitkeep`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: proven source files in `F:\myblog.before-reclone-20261025`
- Produces: `npm run build`, which writes `generator/dist`

- [ ] Copy only build/runtime source and static assets from the backup into `generator/`; exclude writer UI, deploy scripts, nested repositories, generated deployment output, and existing posts.
- [ ] Change the site URL and `CNAME` source value to `https://mineguai.com` / `mineguai.com`.
- [ ] Point the content directory at repository-root `blog/` and make an empty directory valid.
- [ ] Add root ignore rules for `generator/node_modules`, `generator/dist`, `generator/.ssg`, and generated site-data modules.
- [ ] Run `npm ci` and `npm run build` from `generator`; expect exit 0 and a valid empty site in `generator/dist`.
- [ ] Commit the isolated generator import.

### Task 2: Derive Content Metadata From Markdown and Git

**Files:**
- Create: `generator/scripts/git-metadata.ts`
- Create: `generator/tests/git-metadata.test.ts`
- Modify: `generator/scripts/build.ts`
- Modify: `generator/package.json`

**Interfaces:**
- Produces: `readGitDates(repoRoot: string, absoluteFile: string): Promise<{ published: string; modified: string; commitCount: number }>`
- Consumes: one Markdown path inside a Git repository

- [ ] Write tests using temporary Git repositories for one-commit, multi-commit, renamed, untracked-fallback, and Unicode-path files.
- [ ] Run the focused tests and verify they fail because `readGitDates` is absent.
- [ ] Implement `readGitDates` with `git log --follow --format=%aI -- <relative-path>`; use newest and oldest log entries, with filesystem birth/mtime only when history is absent.
- [ ] Run the focused tests and verify all pass.
- [ ] Update content loading to derive title from the first H1, remove that H1 from the rendered body, use filename as slug/title fallback, and use Git dates instead of required front matter dates.
- [ ] Add integration tests for plain Markdown, optional front matter, empty content, and Chinese filenames.
- [ ] Run the full generator test and build commands; expect exit 0.
- [ ] Commit Git-backed Markdown metadata support.

### Task 3: Display Published and Modified Dates Correctly

**Files:**
- Modify: `generator/src/App.tsx`
- Modify: `generator/src/content-utils.ts`
- Create: `generator/tests/content-utils.test.ts`

**Interfaces:**
- Produces: `formatPostDates(date: string, updated: string): { published: string; modified?: string }`
- Consumes: `EvidenceMeta.date` and `EvidenceMeta.updated`

- [ ] Write tests that require creation dates in listing/search views and an optional modified label only when the timestamps differ.
- [ ] Run the tests and verify expected failures.
- [ ] Implement the formatter and update home/archive/search/article metadata rendering; article copy is `发布于 {date}` and optional `修改于 {updated}`.
- [ ] Run all tests and build; inspect generated article markup for accessible `<time datetime>` elements.
- [ ] Commit date presentation changes.

### Task 4: Add the GitHub Pages Deployment Workflow

**Files:**
- Create: `.github/workflows/deploy-pages.yml`

**Interfaces:**
- Consumes: `generator/package-lock.json`, `generator/dist`, full repository history
- Produces: one GitHub Pages deployment artifact

- [ ] Add a workflow triggered by pushes to `main` and manual dispatch, with `contents: read`, `pages: write`, and `id-token: write` permissions.
- [ ] Configure checkout with `fetch-depth: 0`, Node 22 with npm caching, `npm ci`, tests, build, Pages configuration, artifact upload, and deployment.
- [ ] Add Pages concurrency with cancellation of superseded builds.
- [ ] Validate the YAML structure and run the same install/test/build commands locally.
- [ ] Commit and push the migration while retaining current root static output.
- [ ] In repository Pages settings, switch Source from branch deployment to GitHub Actions.
- [ ] Verify the Actions run succeeds and `https://mineguai.com` serves the generated empty site over enforced HTTPS.

### Task 5: Remove Legacy Active-Repository Output

**Files:**
- Delete: `assets/`
- Delete: `clues/`
- Delete: `dossier/`
- Delete: `evidence/`
- Delete: `404.html`
- Delete: `favicon.ico`
- Delete: `favicon.svg`
- Delete: `index.html`
- Delete: `llms.txt`
- Delete: `robots.txt`
- Delete: `rss.xml`
- Delete: `sitemap.xml`
- Delete: root `CNAME` and `.nojekyll` when confirmed unused by Actions

**Interfaces:**
- Consumes: successful deployment from Task 4
- Produces: a source-only active repository

- [ ] Confirm the last Actions deployment is green and the live site is served from its artifact.
- [ ] Remove legacy generated root output while preserving `.git`, `.gitattributes`, `.github`, `blog`, `docs`, and `generator`.
- [ ] Run tests/build and inspect `git diff --check`.
- [ ] Commit and push cleanup.
- [ ] Verify the new Actions deployment and live custom domain again.

### Task 6: Delete Retired Local and GitHub Projects

**Files:**
- Delete after exact-path verification: `F:\myblog.before-reclone-20261025`
- Delete through GitHub settings: `caoxuan5211/mineguai`

**Interfaces:**
- Consumes: verified active repository and live Actions deployment
- Produces: only `F:\myblog` locally and `caoxuan5211/blog` remotely

- [ ] Verify `F:\myblog` resolves exactly to the active workspace and `F:\myblog.before-reclone-20261025` resolves exactly to the intended retired backup.
- [ ] Confirm the backup no longer contains the only copy of any source or content needed by the active generator.
- [ ] Delete the retired backup and report that this removal is not recoverable locally.
- [ ] Open the retired repository Danger Zone, delete `caoxuan5211/mineguai`, and verify its public URL returns 404.
- [ ] Run final checks: clean Git status, origin is `caoxuan5211/blog`, workflow green, `mineguai.com` HTTPS, empty legacy content, and only the requested local/remote project remains.

