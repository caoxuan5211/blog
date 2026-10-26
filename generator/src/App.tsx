import { useEffect, useMemo, useRef, useState } from "react";
import { findRoute, postPath, siteTitle, tagPath } from "./routes";
import { byNewest, estimateReadLabel, formatDate, formatPostDates, normalizeTagSlug, shortTitle } from "./content-utils";
import type { PostDocument, RouteData, SiteData, Theme } from "./types";

type AppProps = {
  route: RouteData;
};

const THEME_KEY = "guai-theme";

function storedThemePreference(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* ignore private-mode storage failures */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") return attr;
  return storedThemePreference();
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#141414" : "#fafafa");
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function App({ route }: AppProps) {
  const [theme, setTheme] = useState<Theme>("light");
  const [searchOpen, setSearchOpen] = useState(false);
  const isHome = route.kind === "home";

  useEffect(() => {
    const initial = readStoredTheme();
    setTheme(initial);
    applyTheme(initial);

    // The DOM snapshot can carry a stale theme: prerendered pages capture it
    // at prerender time, bfcache restores capture it at leave time, and other
    // tabs may change the preference. Re-sync from storage in those cases.
    const sync = () => {
      const stored = storedThemePreference();
      setTheme(stored);
      applyTheme(stored);
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) sync();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_KEY) sync();
    };
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("storage", onStorage);
    if ((document as Document & { prerendering?: boolean }).prerendering) {
      document.addEventListener("prerenderingchange", sync, { once: true });
    }
    return () => {
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("prerenderingchange", sync);
    };
  }, []);

  useEffect(() => {
    setSearchOpen(route.kind === "home" && window.location.hash === "#search");
  }, [route.kind]);

  useEffect(() => {
    if (!searchOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSearchOpen(false);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [searchOpen]);

  const toggleSearch = () => {
    if (!isHome) {
      window.location.href = "/#search";
      return;
    }
    setSearchOpen((current) => {
      const next = !current;
      window.history.replaceState(null, "", next ? "/#search" : window.location.pathname + window.location.search);
      return next;
    });
  };

  const closeSearch = () => {
    setSearchOpen(false);
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  };

  const toggleTheme = () => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  };

  return (
    <>
      <a className="skip-link" href="#content">跳到正文</a>
      {route.kind === "post" ? <div className="scroll-progress" aria-hidden="true" /> : null}
      <SiteHeader searchOpen={searchOpen} onToggleSearch={toggleSearch} theme={theme} onToggleTheme={toggleTheme} />
      <main id="content" className={`site-main${isHome ? " site-main--home" : ""}`}>
        <RouteSwitch route={route} searchOpen={searchOpen} onCloseSearch={closeSearch} />
      </main>
      <SiteFooter />
      <BackToTop />
    </>
  );
}

export function AppForPath({ path, site }: { path: string; site: SiteData }) {
  return <App route={findRoute(path, site)} />;
}

function SiteHeader({
  searchOpen,
  onToggleSearch,
  theme,
  onToggleTheme
}: {
  searchOpen: boolean;
  onToggleSearch: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  return (
    <header className="site-header">
      <div className="shell site-header__row">
        <a className="brand" href="/" aria-label={`${siteTitle}，返回首页`}>
          <span className="brand__mark">{siteTitle}</span>
          <img className="brand__avatar" src="/assets/images/wanzi1-720.jpg" alt="" width="24" height="24" decoding="async" />
        </a>
        <div className="site-header__tools">
          <button
            className="tool-button tool-button--search"
            type="button"
            onClick={onToggleSearch}
            aria-label="搜索"
            aria-expanded={searchOpen}
          >
            <Icon name="search" />
          </button>
          <a className="tool-button tool-button--tag" href="/tags/" aria-label="标签" title="标签">
            <Icon name="tag" />
          </a>
          <ThemeRocker theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
    </header>
  );
}

function ThemeRocker({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const isDark = theme === "dark";
  return (
    <button
      className="tool-button tool-button--theme"
      type="button"
      onClick={onToggle}
      title={isDark ? "切换到浅色" : "切换到深色"}
      aria-label={isDark ? "切换到浅色" : "切换到深色"}
    >
      <Icon name={isDark ? "sun" : "moon"} />
    </button>
  );
}

function RouteSwitch({ route, searchOpen, onCloseSearch }: { route: RouteData; searchOpen: boolean; onCloseSearch: () => void }) {
  if (route.kind === "home") return <HomePage site={route.site} searchOpen={searchOpen} onCloseSearch={onCloseSearch} />;
  if (route.kind === "tags") return <TagsPage site={route.site} />;
  if (route.kind === "tag") return <TagPage site={route.site} tag={route.tag} />;
  if (route.kind === "post") return <PostPage post={route.post} />;
  return <NotFoundPage site={route.site} />;
}

/* ---------------------------------- home ---------------------------------- */

function HomePage({ site, searchOpen, onCloseSearch }: { site: SiteData; searchOpen: boolean; onCloseSearch: () => void }) {
  const posts = byNewest(site.posts);
  const [query, setQuery] = useState("");
  const browserRef = useRef<HTMLDivElement | null>(null);
  const terms = normalizeSearchText(query).split(" ").filter(Boolean);
  const results = terms.length
    ? posts.filter((post) => terms.every((term) =>
        normalizeSearchText(`${post.meta.title} ${post.meta.tags.join(" ")} ${post.plainText}`).includes(term)
      ))
    : posts;

  useEffect(() => {
    if (!searchOpen) setQuery("");
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target || browserRef.current?.contains(target) || target.closest(".tool-button--search")) return;
      onCloseSearch();
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [searchOpen, onCloseSearch]);

  return (
    <div className="home-page">
      <h1 className="sr-only">{siteTitle}</h1>

      <div className="home-browser shell" ref={browserRef}>
        <div className={`inline-search-wrap${searchOpen ? " is-open" : ""}`} aria-hidden={!searchOpen} inert={!searchOpen}>
          <div className="inline-search">
            <Icon name="search" />
            <input
              id="search"
              type="text"
              role="searchbox"
              inputMode="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索…"
              aria-label="搜索文章"
              autoFocus={searchOpen}
              disabled={!searchOpen}
              tabIndex={searchOpen ? 0 : -1}
            />
            <button type="button" onClick={onCloseSearch} aria-label="关闭搜索" disabled={!searchOpen}><Icon name="close" /></button>
          </div>
        </div>

        <section className="section" aria-label="最近文章">
          {results.length ? <PostRows posts={results} quiet /> : query ? <p className="inline-search__empty">无结果</p> : <PostRows posts={[]} quiet />}
        </section>
      </div>
    </div>
  );
}


function PostRows({ posts, quiet = false }: { posts: PostDocument[]; quiet?: boolean }) {
  return (
    <ol className={`post-rows${quiet ? " post-rows--quiet" : ""}`} data-reveal={quiet ? undefined : true}>
      {posts.map((post, index) => (
        <li key={post.meta.slug}>
          <a className="post-row" href={postPath(post)}>
            {!quiet ? <span className="post-row__no">{String(index + 1).padStart(2, "0")}</span> : null}
            <span className="post-row__title">
              <strong>{shortTitle(post.meta.title, 40)}</strong>
              {post.meta.draft ? <i className="stamp">草稿</i> : null}
            </span>
            <span className="post-row__meta">
              <time dateTime={post.meta.date}>{formatDate(post.meta.date)}</time>
              {!quiet ? <em>{estimateReadLabel(post.meta.readingTime)}</em> : null}
            </span>
            {!quiet ? <span className="post-row__arrow" aria-hidden="true">↗</span> : null}
          </a>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------- inner pages ------------------------------ */

function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="page-shell shell">
      <header className="page-intro" data-reveal>
        <h1>{title}</h1>
      </header>
      {children}
    </section>
  );
}

function TagsPage({ site }: { site: SiteData }) {
  return (
    <section className="page-shell shell tag-page">
      {site.tags.length ? (
        <div className="tag-list">
          {site.tags.map((tag) => (
            <a key={tag.slug} className="tag-link" href={tagPath(tag.slug)}>
              <span>{tag.name}</span><small>{tag.count} 篇</small>
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function TagPage({ site, tag }: { site: SiteData; tag: string }) {
  const summary = site.tags.find((item) => item.slug === tag);
  const posts = byNewest(site.posts).filter((post) =>
    post.meta.tags.some((name) => normalizeTagSlug(name) === tag)
  );
  return (
    <PageShell title={`#${summary?.name || decodeURIComponent(tag)}`}>
      <PostRows posts={posts} />
    </PageShell>
  );
}

function PostPage({ post }: { post: PostDocument }) {
  const headingView = useMemo(() => buildHeadingView(post.html), [post.html]);
  const dates = formatPostDates(post.meta.date, post.meta.updated);
  return (
    <article className="entry-shell shell">
      <header className="entry-hero" data-reveal>
        <h1>{post.meta.title}</h1>
        <div className="entry-hero__meta">
          <time dateTime={post.meta.date}>{dates.published}</time>
          {dates.modified ? <time dateTime={post.meta.updated}>修改于 {dates.modified}</time> : null}
          <span>{estimateReadLabel(post.meta.readingTime)}</span>
          {post.meta.draft ? <span className="stamp">草稿</span> : null}
          {post.meta.tags.map((tag) => (
            <a key={normalizeTagSlug(tag)} className="entry-tag" href={tagPath(normalizeTagSlug(tag))}>#{tag}</a>
          ))}
        </div>
      </header>
      <div className="entry-body">
        <div className="manuscript" dangerouslySetInnerHTML={{ __html: headingView.html }} />
      </div>
      <PostToc headings={headingView.headings} />
    </article>
  );
}

type TocHeading = { id: string; level: number; text: string };

function PostToc({ headings }: { headings: TocHeading[] }) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (headings.length < 2) return;
    const nodes = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((node): node is HTMLElement => Boolean(node));
    if (!nodes.length) return;

    let scheduled = false;
    const update = () => {
      scheduled = false;
      const line = window.innerHeight * 0.28;
      let current = nodes[0].id;
      for (const node of nodes) {
        if (node.getBoundingClientRect().top <= line) current = node.id;
        else break;
      }
      setActiveId(current);
    };
    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [headings]);

  if (headings.length < 2) return null;

  return (
    <aside className={`entry-toc${open ? " is-open" : ""}`} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button className="entry-toc__tab" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        目录
      </button>
      <nav className="entry-toc__panel" aria-label="文章目录">
        <strong>本页目录</strong>
        <ol>
          {headings.map((heading) => (
            <li key={heading.id} className={`toc-level-${heading.level}`}>
              <a
                href={`#${heading.id}`}
                className={heading.id === activeId ? "is-current" : undefined}
                aria-current={heading.id === activeId ? "true" : undefined}
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </aside>
  );
}

function NotFoundPage({ site }: { site: SiteData }) {
  return (
    <PageShell title="404">
      <PostRows posts={byNewest(site.posts).slice(0, 4)} />
    </PageShell>
  );
}

function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let scheduled = false;
    const update = () => {
      scheduled = false;
      setVisible(window.scrollY > 480);
    };
    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTop = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <button
      className={`back-top${visible ? " is-visible" : ""}`}
      type="button"
      aria-label="回到顶部"
      tabIndex={visible ? 0 : -1}
      onClick={scrollTop}
    >
      <Icon name="arrow-up" />
    </button>
  );
}

/* --------------------------------- footer --------------------------------- */

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell site-footer__row">
        <p className="site-footer__colophon">
          © 2026 {siteTitle}
        </p>
        <a className="site-footer__rss" href="/rss.xml">RSS</a>
      </div>
    </footer>
  );
}

/* --------------------------------- helpers -------------------------------- */

function buildHeadingView(html: string): { html: string; headings: TocHeading[] } {
  const used = new Map<string, number>();
  const headings: TocHeading[] = [];
  const withIds = html.replace(/<h([2-4])([^>]*)>([\s\S]*?)<\/h\1>/g, (full, levelText: string, attrs: string, inner: string) => {
    const text = decodeHtml(stripTags(inner)).trim();
    if (!text) return full;
    const existingId = attrs.match(/\sid=("|')([^"']+)\1/)?.[2];
    if (existingId) {
      headings.push({ id: existingId, level: Number(levelText), text });
      return full;
    }
    const base = slugHeading(text);
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    const id = count ? `${base}-${count + 1}` : base;
    headings.push({ id, level: Number(levelText), text });
    return `<h${levelText}${attrs} id="${id}">${inner}</h${levelText}>`;
  });
  return { html: withIds, headings };
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function slugHeading(value: string) {
  return value.toLowerCase().replace(/[`"'“”‘’]/g, "").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "section";
}

function Icon({ name }: { name: string }) {
  if (name === "search") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></svg>;
  }
  if (name === "tag") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13 13 20 4 11V4h7l9 9Z" /><circle cx="8.5" cy="8.5" r="1" /></svg>;
  }
  if (name === "close") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>;
  }
  if (name === "arrow-up") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" /></svg>;
  }
  if (name === "sun") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    );
  }
  if (name === "moon") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
        <path d="M20.5 14.2A8.2 8.2 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z" />
      </svg>
    );
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" /></svg>;
}
