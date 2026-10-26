# Blog Tags Navigation Design

## Intent

Add a conventional, shareable tag system without restoring any old `clues`/dossier architecture. Remove the centered `博客` navigation label and place a tag SVG link between the search and theme controls.

## Behavior

- Tags come only from explicit Markdown front matter such as `tags: [AI, LLM, Study]`.
- The generator never infers, suggests, or adds tags from filenames, titles, or article text.
- Posts without `tags` remain valid and appear normally.
- `/tags/` lists only tags currently used by published posts, with post counts.
- `/tags/<slug>/` lists only posts carrying that tag.
- Tags on an article are displayed as links to their tag pages.
- Search matches titles, body text, and explicitly declared tags.
- Tag pages are included in sitemap output; RSS continues to contain posts only.
- If no published post has tags, `/tags/` displays an empty-state message rather than sample tags.

## Normalization

- Tag matching and slugs are case-insensitive (`AI` and `ai` are one tag).
- The first published spelling is used as the display name.
- Tags are ordered by post count descending, then by display name.

## Header

- Remove the centered `博客` text and its navigation container.
- Keep the brand on the left.
- Keep tools on the right in this order: search SVG, tag SVG, theme SVG.
- The tag SVG is an accessible link with `aria-label="标签"` to `/tags/`.

## Approaches

1. Dedicated `/tags/` and `/tags/<slug>/` pages — selected because routes are conventional, bookmarkable, and shareable.
2. Modal/drawer — rejected because state is not shareable and adds unnecessary client complexity.
3. Homepage tag cloud — rejected because it adds visual clutter the user explicitly removed.

## Constraints

- Preserve `/blog/<slug>/`, current React styling, search, theme switching, RSS, sitemap, Git-derived dates, GitHub Actions deployment, and `mineguai.com`.
- Use `tags` naming throughout; do not reintroduce `clues`, `evidence`, or dossier terminology.

