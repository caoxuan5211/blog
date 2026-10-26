import { useEffect, useMemo, useRef, useState } from "react";
import { findRoute, postPath, siteTitle } from "./routes";
import { byNewest, estimateReadLabel, formatDate, formatPostDates, shortTitle } from "./content-utils";
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
  const [commandOpen, setCommandOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const searchTrigger = useRef<HTMLElement | null>(null);
  const isHome = route.kind === "home";
  const openCommand = () => {
    searchTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCommandOpen(true);
  };
  const closeCommand = () => {
    setCommandOpen(false);
    window.requestAnimationFrame(() => searchTrigger.current?.focus());
  };

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
    const openSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      const plainSlash = event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey;
      if (!typing && (plainSlash || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k"))) {
        event.preventDefault();
        openCommand();
      }
    };
    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, []);

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
      <SiteHeader onSearch={openCommand} theme={theme} onToggleTheme={toggleTheme} />
      <main id="content" className={`site-main${isHome ? " site-main--home" : ""}`}>
        <RouteSwitch route={route} />
      </main>
      <SiteFooter />
      <BackToTop />
      <CommandPanel site={route.site} open={commandOpen} onClose={closeCommand} />
    </>
  );
}

export function AppForPath({ path, site }: { path: string; site: SiteData }) {
  return <App route={findRoute(path, site)} />;
}

function SiteHeader({
  onSearch,
  theme,
  onToggleTheme
}: {
  onSearch: () => void;
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
        <nav className="site-nav" aria-label="主导航">
          <a href="/" className="is-active" aria-current="page"><strong>博客</strong></a>
        </nav>
        <div className="site-header__tools">
          <button className="tool-button tool-button--search" type="button" onClick={onSearch} aria-label="搜索">
            <span>搜索</span>
          </button>
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

function RouteSwitch({ route }: { route: RouteData }) {
  if (route.kind === "home") return <HomePage site={route.site} />;
  if (route.kind === "post") return <PostPage post={route.post} />;
  return <NotFoundPage site={route.site} />;
}

/* ---------------------------------- home ---------------------------------- */

function HomePage({ site }: { site: SiteData }) {
  const posts = byNewest(site.posts);

  return (
    <div className="home-page">
      <h1 className="sr-only">{siteTitle}</h1>

      <section className="section shell" aria-label="最近文章">
        <PostRows posts={posts} quiet />
      </section>
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

function PostPage({ post }: { post: PostDocument }) {
  const headingView = useMemo(() => buildHeadingView(post.html), [post.html]);
  const dates = formatPostDates(post.meta.date, post.meta.updated);
  return (
    <article className="entry-shell shell">
      <header className="entry-hero" data-reveal>
        <div className="entry-hero__topline">
          <a className="entry-back" href="/">← 返回博客</a>
        </div>
        <h1>{post.meta.title}</h1>
        <div className="entry-hero__meta">
          <time dateTime={post.meta.date}>发布于 {dates.published}</time>
          {dates.modified ? <time dateTime={post.meta.updated}>修改于 {dates.modified}</time> : null}
          <span>{estimateReadLabel(post.meta.readingTime)}</span>
          {post.meta.draft ? <span className="stamp">草稿</span> : null}
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

/* --------------------------------- search --------------------------------- */

function CommandPanel({ site, open, onClose }: { site: SiteData; open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchSource = useMemo(() => byNewest(site.posts).map((post) => ({
    post,
    title: normalizeSearchText(post.meta.title),
    body: normalizeSearchText(post.plainText.slice(0, 4000))
  })), [site.posts]);
  const results = useMemo(() => {
    const terms = normalizeSearchText(query).split(" ").filter(Boolean);
    if (!terms.length) return searchSource.slice(0, 8).map((item) => item.post);
    return searchSource
      .map((item) => ({
        post: item.post,
        score: terms.reduce((total, term) => total
          + (item.title.includes(term) ? 12 : 0)
          + (item.body.includes(term) ? 2 : 0), 0)
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 12)
      .map((item) => item.post);
  }, [query, searchSource]);

  useEffect(() => setActiveIndex(0), [query, results.length]);

  useEffect(() => {
    if (!open || !results.length) return;
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>(`#search-result-${activeIndex}`);
    if (!active) return;
    active.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeIndex, open, results.length]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);
  if (!open) return null;

  const openActiveResult = () => {
    const target = results[activeIndex];
    if (!target) return;
    window.location.href = postPath(target);
    onClose();
  };

  const handleKeys = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "Tab") {
      const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
        'input, button:not([disabled]), a[href]'
      ));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
      return;
    }
    if ((event.target as HTMLElement).getAttribute("role") !== "combobox") return;
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, results.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    }
    if (event.key === "Enter") {
      event.preventDefault();
      openActiveResult();
    }
  };

  return (
    <div className="command-layer" role="dialog" aria-modal="true" aria-label="搜索文章">
      <button className="command-layer__backdrop" type="button" onClick={onClose} aria-label="关闭搜索" />
      <section className="command-panel" onKeyDown={handleKeys}>
        <div className="command-panel__input-row">
          <span className="command-panel__search-icon" aria-hidden="true">
            <Icon name="search" />
          </span>
          <input
            autoFocus
            aria-label="搜索文章"
            aria-controls="search-results"
            aria-expanded="true"
            aria-activedescendant={results[activeIndex] ? `search-result-${activeIndex}` : undefined}
            role="combobox"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题或正文…"
          />
          {query ? (
            <button
              className="command-panel__clear"
              type="button"
              onClick={() => setQuery("")}
              aria-label="清空搜索"
            >
              <Icon name="close" />
            </button>
          ) : null}
          <button className="command-panel__close" type="button" onClick={onClose} aria-label="关闭">
            <kbd>esc</kbd>
          </button>
        </div>
        <div className="command-panel__meta">
          <span>{query ? `${results.length} 条结果` : `最近 ${Math.min(results.length, 12)} 篇`}</span>
          <span className="command-panel__hint">↑↓ 选择 · Enter 打开</span>
        </div>
        <div id="search-results" ref={listRef} className="command-panel__results" role="listbox" aria-label="搜索结果">
          {results.map((post, index) => (
            <a
              key={post.meta.slug}
              id={`search-result-${index}`}
              href={postPath(post)}
              className={index === activeIndex ? "is-active" : ""}
              role="option"
              aria-selected={index === activeIndex}
              onMouseMove={() => {
                if (activeIndex !== index) setActiveIndex(index);
              }}
              onClick={onClose}
            >
              <span className="command-panel__date">{formatDate(post.meta.date)}</span>
              <strong className="command-panel__title">{shortTitle(post.meta.title, 40)}</strong>
              <em className="command-panel__sub">{commandMeta(post)}</em>
              <i className="command-panel__arrow" aria-hidden="true">→</i>
            </a>
          ))}
          {!results.length ? (
            <p className="command-panel__empty">
              没有找到匹配内容
              <small>试试更短的关键词</small>
            </p>
          ) : null}
        </div>
      </section>
    </div>
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

function commandMeta(post: PostDocument) {
  return estimateReadLabel(post.meta.readingTime);
}

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
