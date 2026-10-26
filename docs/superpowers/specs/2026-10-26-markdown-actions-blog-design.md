# Markdown Push-to-Publish Blog Design

## Intent

Keep the current React/Vite blog appearance, search, dark mode, archives, tags, RSS, sitemap, SEO metadata, and `mineguai.com`, while making the author's daily workflow only:

```powershell
git add .
git commit -m "..."
git push
```

Markdown posts live in `blog/*.md`. GitHub Actions performs every build and deploy step.

## Goals

- Accept plain Markdown files in the repository-root `blog/` directory.
- Use the first level-one Markdown heading as the article title, falling back to the filename.
- Use Git history for dates: the first commit touching the file is the publication time; the latest commit touching it is the modification time.
- Show the publication date on listing/search views and show `发布于 … · 修改于 …` on an article only when it has been changed after publication.
- Build and deploy automatically after pushes to `main`.
- Start with no legacy/sample posts.
- Preserve the current visual design and custom domain.
- End with only the active `caoxuan5211/blog` GitHub repository and active `F:\myblog` local project.

## Non-goals

- No browser CMS, database, comments backend, or server-side runtime.
- No requirement to run Node, npm, or a build command during normal authoring.
- No Jekyll migration or replacement theme.
- No guarantee that filesystem creation timestamps survive; Git history is the source of truth after commit.

## Constraints

- GitHub Actions must check out full history (`fetch-depth: 0`).
- A new uncommitted local file may use filesystem timestamps for preview, but deployed dates always come from Git.
- Optional YAML/TOML front matter remains supported for tags, categories, draft state, and cover images; title and dates do not require it.
- The custom domain is `https://mineguai.com`.
- The existing branch-published site must remain available until the Actions deployment succeeds.
- Destructive cleanup happens only after the Actions site is verified.

## Approaches

1. **Existing generator executed by GitHub Actions — selected.** Preserves the current site while removing local build work.
2. Local build-and-push scripts. Rejected because authoring would depend on one configured computer.
3. GitHub Pages Jekyll. Rejected because it replaces the current React presentation or requires rebuilding that presentation as a Jekyll theme.

## Architecture

- `blog/` contains author-owned Markdown only.
- `generator/` contains the existing React/Vite static generator, trimmed of local writer/deploy helpers.
- The generator reads `../blog`, derives Git dates through a focused metadata module, generates `generator/dist`, and never commits `dist`.
- `.github/workflows/deploy-pages.yml` tests, builds, uploads `generator/dist`, and deploys it through GitHub Pages.
- Migration is staged: add the new pipeline while retaining the current root static output; switch Pages to GitHub Actions and verify; then delete legacy root output and external leftovers.

## Content Rules

- URL slug: Markdown filename without `.md`.
- Title: first `# Heading`; fallback to filename.
- The title heading is removed from rendered article body to avoid duplication with the page heading.
- Published: oldest Git commit that includes the Markdown path, following renames.
- Modified: newest Git commit that touches the Markdown path, following renames.
- When both dates come from the same commit, only the published date is displayed.

## Cleanup

After successful Actions deployment:

- Delete the two legacy posts and all generated copies from the active repository.
- Delete legacy root deployment files that are no longer Pages inputs.
- Delete `F:\myblog.before-reclone-20261025` after resolving and verifying that exact path.
- Delete the retired GitHub repository `caoxuan5211/mineguai` through GitHub account settings, then verify it returns 404.
- Preserve only the active local project `F:\myblog` and GitHub repository `caoxuan5211/blog`.

