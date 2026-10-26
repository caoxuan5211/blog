import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { createHighlighter } from "shiki";
import { build as viteBuild } from "vite";
import { parsePostSource, slugifyPost, type FrontMatter } from "./content-source";
import { readGitDates } from "./git-metadata";
import { dedupeTags, summarizeTags } from "../src/content-utils";
import { allRoutes, routePath, siteDescription, siteTitle, siteUrl } from "../src/routes";
import type { PostMeta, RouteData, SiteData } from "../src/types";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const repoRoot = path.resolve(process.env.BLOG_REPO_ROOT || path.join(root, ".."));
const contentDir = path.resolve(process.env.BLOG_CONTENT_DIR || path.join(repoRoot, "blog"));
const generatedDir = path.join(root, "src", "generated");
const distDir = path.join(root, "dist");
const ssrOutDir = path.join(root, ".ssg");

const ensureDir = async (target: string) => {
  await fs.mkdir(target, { recursive: true });
};

const walk = async (dir: string): Promise<string[]> => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(target);
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) return [target];
      return [];
    })
  );
  return files.flat();
};

const toBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  if (typeof value === "number") return value === 1;
  return false;
};

const readTime = (plainText: string): number => {
  const cjk = (plainText.match(/[\u4e00-\u9fff]/g) || []).length;
  const words = (plainText.replace(/[\u4e00-\u9fff]/g, " ").match(/\b[\w-]+\b/g) || []).length;
  return Math.max(1, Math.ceil((cjk + words) / 420));
};

const stripHtml = (value: string): string =>
  value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const parseCover = (data: FrontMatter): PostMeta["cover"] => {
  const params = data.params;
  if (params && typeof params === "object" && "cover" in params) {
    const cover = (params as Record<string, unknown>).cover;
    if (cover && typeof cover === "object") {
      const raw = cover as Record<string, unknown>;
      if (raw.image) {
        return {
          image: String(raw.image),
          alt: raw.alt ? String(raw.alt) : undefined,
          relative: Boolean(raw.relative)
        };
      }
    }
  }
  if (data.cover || data.image) {
    return { image: String(data.cover || data.image) };
  }
  return undefined;
};

const normalizeRefLinks = (markdown: string, slugsByBase: Map<string, string>): string =>
  markdown
    .replace(/\{\{<\s*ref\s+"([^"]+)"\s*>\}\}/g, (_, target: string) => {
      const key = target.replace(/\\/g, "/").split("/").pop()?.replace(/\.md$/i, "").toLowerCase() || target.toLowerCase();
      const slug = slugsByBase.get(key);
      return slug ? `/blog/${slug}/` : "#missing-ref";
    })
    .replace(/\{\{<\s*ref\s+([^>\s]+)\s*>\}\}/g, (_, target: string) => {
      const key = String(target).replace(/["']/g, "").replace(/\\/g, "/").split("/").pop()?.replace(/\.md$/i, "").toLowerCase() || String(target).toLowerCase();
      const slug = slugsByBase.get(key);
      return slug ? `/blog/${slug}/` : "#missing-ref";
    });

const normalizeLang = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, string> = {
    "c++": "cpp",
    "cxx": "cpp",
    "cc": "cpp",
    "js": "javascript",
    "ts": "typescript",
    "shell": "bash",
    "ps": "powershell",
    "ps1": "powershell",
    "md": "markdown"
  };
  const lang = aliases[normalized] || normalized || "text";
  const loaded = new Set(["javascript", "typescript", "cpp", "c", "python", "bash", "powershell", "json", "markdown", "html", "css", "text"]);
  return loaded.has(lang) ? lang : "text";
};

const assetExists = async (urlPath: string): Promise<boolean> => {
  const local = path.join(root, "site-public", ...urlPath.replace(/^\/+/, "").split("/"));
  try {
    await fs.access(local);
    return true;
  } catch {
    return false;
  }
};

const missingImage = (src: string): string =>
  `<figure class="missing-asset"><span>图片缺失</span><code>${escapeHtml(src)}</code></figure>`;

const decorateImage = (tag: string, eager = false): string => {
  let next = tag;
  if (!/\sloading=/.test(next)) {
    // The first article image is usually the LCP element — load it eagerly.
    next = next.replace("<img", eager ? '<img loading="eager" fetchpriority="high"' : '<img loading="lazy"');
  }
  if (!/\sdecoding=/.test(next)) next = next.replace("<img", '<img decoding="async"');
  if (!/\salt=/.test(next)) next = next.replace("<img", '<img alt="文章配图"');
  return next;
};

const fixImagePaths = async (html: string): Promise<string> => {
  const pattern = /<img([^>]*?)src="([^"]+)"([^>]*)>/g;
  let output = "";
  let cursor = 0;
  let imageIndex = 0;

  for (const match of html.matchAll(pattern)) {
    const [full, before, src, after] = match;
    output += html.slice(cursor, match.index);
    cursor = (match.index || 0) + full.length;
    const eager = imageIndex === 0;
    imageIndex += 1;

    if (/^https?:\/\//.test(src)) {
      output += decorateImage(full, eager);
      continue;
    }

    if (/^[a-zA-Z]:(?:\\|\/|%5[cC])/.test(src)) {
      output += missingImage(src);
      continue;
    }

    if (src.startsWith("/images/")) {
      const next = `/assets${src}`;
      output += (await assetExists(next)) ? decorateImage(`<img${before}src="${next}"${after}>`, eager) : missingImage(src);
      continue;
    }

    if (src.startsWith("images/")) {
      const next = `/assets/images/${src.replace(/^images\//, "")}`;
      output += (await assetExists(next)) ? decorateImage(`<img${before}src="${next}"${after}>`, eager) : missingImage(src);
      continue;
    }

    output += decorateImage(full, eager);
  }

  return output + html.slice(cursor);
};

let highlighterPromise: ReturnType<typeof createHighlighter> | undefined;

const getHighlighter = () => {
  highlighterPromise ??= createHighlighter({
    themes: [
      {
        name: "guai-ink",
        type: "light",
        colors: {
          "editor.background": "#171b12",
          "editor.foreground": "#f4f5ec"
        },
        tokenColors: [
          { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: "#9aa28d", fontStyle: "italic" } },
          { scope: ["keyword", "storage", "storage.type", "storage.modifier"], settings: { foreground: "#b8ef58", fontStyle: "bold" } },
          { scope: ["constant.numeric", "constant.language", "constant.character"], settings: { foreground: "#f0bf6a" } },
          { scope: ["string", "string.quoted", "string punctuation"], settings: { foreground: "#d3e69a" } },
          { scope: ["entity.name.function", "support.function"], settings: { foreground: "#f4f5ec" } },
          { scope: ["entity.name.type", "support.type", "support.class"], settings: { foreground: "#88d4c4" } },
          { scope: ["variable", "variable.other", "parameter"], settings: { foreground: "#e8e9df" } },
          { scope: ["meta.preprocessor", "keyword.control.directive", "punctuation.definition.directive"], settings: { foreground: "#e4a7b6" } },
          { scope: ["punctuation", "operator"], settings: { foreground: "#bac1ad" } }
        ]
      }
    ],
    langs: ["javascript", "typescript", "cpp", "c", "python", "bash", "powershell", "json", "markdown", "html", "css"]
  });
  return highlighterPromise;
};

const renderMarkdown = async (markdown: string): Promise<string> => {
  const highlighter = await getHighlighter();

  const tree = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize)
    .use(() => (node: any) => {
      const visit = (target: any) => {
        if (!target || typeof target !== "object") return;
        if (target.tagName === "pre" && Array.isArray(target.children)) {
          const code = target.children.find((child: any) => child.tagName === "code");
          const className = code?.properties?.className || [];
          const langClass = Array.isArray(className) ? className.find((item) => String(item).startsWith("language-")) : "";
          const lang = normalizeLang(String(langClass || "language-text").replace("language-", ""));
          const source = Array.isArray(code?.children) ? code.children.map((child: any) => child.value || "").join("") : "";
          const highlighted = highlighter
            .codeToHtml(source, { lang: lang || "text", theme: "guai-ink" })
            .replace("<pre ", `<pre data-lang="${lang || "text"}" `);
          target.type = "raw";
          target.value = highlighted;
          delete target.tagName;
          delete target.properties;
          delete target.children;
          return;
        }
        if (Array.isArray(target.children)) target.children.forEach(visit);
      };
      visit(node);
    })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);

  const normalizedHeadings = String(tree)
    // Demote every heading one level so the page <h1> stays unique,
    // while preserving relative hierarchy (## must stay under #).
    .replace(/<h([1-5])(\b[^>]*)>/g, (_full, level: string, attrs: string) => `<h${Number(level) + 1}${attrs}>`)
    .replace(/<\/h([1-5])>/g, (_full, level: string) => `</h${Number(level) + 1}>`)
    .replace(/<h([2-6])([^>]*)>\s*<\/h\1>/g, "")
    // External links open in a new tab without leaking the opener.
    .replace(/<a\s([^>]*href="https?:\/\/[^"]*"[^>]*)>/g, (full, attrs: string) => {
      if (attrs.includes(`href="${siteUrl}`)) return full;
      let next = attrs;
      if (!/\btarget=/.test(next)) next += ' target="_blank"';
      if (!/\brel=/.test(next)) next += ' rel="noopener noreferrer"';
      return `<a ${next}>`;
    });
  return fixImagePaths(normalizedHeadings);
};

const loadSite = async (): Promise<SiteData> => {
  const files = await walk(contentDir);
  const slugsByBase = new Map<string, string>();
  files.forEach((file) => {
    const base = path.basename(file, ".md").toLowerCase();
    slugsByBase.set(base, slugifyPost(file, contentDir));
  });

  const posts = await Promise.all(
    files.map(async (file) => {
      const raw = await fs.readFile(file, "utf8");
      const parsed = parsePostSource(raw, path.basename(file, ".md"));
      const body = normalizeRefLinks(parsed.body, slugsByBase);
      const html = await renderMarkdown(body);
      const plainText = stripHtml(html);
      const dates = await readGitDates(repoRoot, file);
      const explicitTags = Array.isArray(parsed.data.tags)
        ? parsed.data.tags.map(String)
        : parsed.data.tags
          ? [String(parsed.data.tags)]
          : [];
      const meta: PostMeta = {
        title: parsed.title,
        date: dates.published,
        updated: dates.modified,
        draft: toBoolean(parsed.data.draft),
        tags: dedupeTags(explicitTags),
        slug: slugifyPost(file, contentDir),
        sourcePath: path.relative(repoRoot, file).replace(/\\/g, "/"),
        readingTime: readTime(plainText),
        cover: parseCover(parsed.data)
      };
      return { meta, html, plainText };
    })
  );

  const visiblePosts = process.env.INCLUDE_DRAFTS === "true"
    ? posts
    : posts.filter((post) => !post.meta.draft);
  visiblePosts.sort((left, right) => new Date(right.meta.date).getTime() - new Date(left.meta.date).getTime());
  const tags = summarizeTags(visiblePosts.map((post) => ({ date: post.meta.date, tags: post.meta.tags })));
  return { posts: visiblePosts, tags };
};

const writeGeneratedData = async (site: SiteData) => {
  await ensureDir(generatedDir);
  // The client bundle only needs metadata and search text: article HTML is
  // restored from the server-rendered DOM at hydration time (see client.tsx),
  // so the bundle stays flat as the number of posts grows.
  const slim: SiteData = {
    ...site,
    posts: site.posts.map((post) => ({
      ...post,
      html: "",
      plainText: post.plainText.slice(0, 4000)
    }))
  };
  const payload = `import type { SiteData } from "../types";\n\nexport const siteData: SiteData = ${JSON.stringify(slim)};\n`;
  await fs.writeFile(path.join(generatedDir, "site-data.ts"), payload, "utf8");
  // Full payload for the dev server, where there is no pre-rendered DOM to read from.
  const fullPayload = `import type { SiteData } from "../types";\n\nexport const siteDataFull: SiteData = ${JSON.stringify(site)};\n`;
  await fs.writeFile(path.join(generatedDir, "site-data-full.ts"), fullPayload, "utf8");
};

const writePublishAttributes = async () => {
  await fs.writeFile(
    path.join(distDir, ".gitattributes"),
    "* text eol=lf\n*.png binary\n*.jpg binary\n*.jpeg binary\n*.gif binary\n*.ico binary\n*.woff binary\n*.woff2 binary\n",
    "utf8"
  );
};

const htmlPathForRoute = (route: RouteData): string => {
  if (route.kind === "not-found") return path.join(distDir, "404.html");
  const routeName = routePath(route).replace(/^\/|\/$/g, "");
  if (!routeName) return path.join(distDir, "index.html");
  const fileParts = routeName.split("/").map((part) => decodeURIComponent(part));
  return path.join(distDir, ...fileParts, "index.html");
};

const pageTitle = (route: RouteData): string => {
  if (route.kind === "home") return siteTitle;
  if (route.kind === "tags") return `标签 · ${siteTitle}`;
  if (route.kind === "tag") return `#${route.site.tags.find((tag) => tag.slug === route.tag)?.name || decodeURIComponent(route.tag)} · ${siteTitle}`;
  if (route.kind === "post") return `${route.post.meta.title} · ${siteTitle}`;
  return `页面不存在 · ${siteTitle}`;
};

const renderPage = async (route: RouteData, template: string, render: (route: RouteData) => string) => {
  const appHtml = render(route);
  const title = pageTitle(route);
  const description = route.kind === "post" ? route.post.plainText.slice(0, 140) : siteDescription;
  const canonical = new URL(routePath(route), siteUrl).href;
  const image = new URL("/assets/images/wanzi1.jpg", siteUrl).href;
  const isArticle = route.kind === "post";
  const isNotFound = route.kind === "not-found";
  const structuredData = isNotFound ? null : isArticle
    ? {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: route.post.meta.title,
        description,
        datePublished: route.post.meta.date,
        dateModified: route.post.meta.updated || route.post.meta.date,
        mainEntityOfPage: canonical,
        image,
        author: { "@type": "Person", name: siteTitle, url: siteUrl },
        publisher: { "@type": "Person", name: siteTitle, url: siteUrl }
      }
    : {
        "@context": "https://schema.org",
        "@type": "Blog",
        name: siteTitle,
        description: siteDescription,
        url: canonical,
        image,
        author: { "@type": "Person", name: siteTitle, url: siteUrl }
      };
  const socialMeta = [
    `<meta name="robots" content="${isNotFound ? "noindex,follow" : "index,follow,max-image-preview:large"}" />`,
    `<meta property="og:type" content="${isArticle ? "article" : "website"}" />`,
    `<meta property="og:locale" content="zh_CN" />`,
    `<meta property="og:site_name" content="${escapeHtml(siteTitle)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(siteTitle)} 的头像" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    isArticle ? `<meta property="article:published_time" content="${route.post.meta.date}" />` : "",
    isArticle ? `<meta property="article:modified_time" content="${route.post.meta.updated || route.post.meta.date}" />` : "",
    isNotFound ? "" : `<link rel="canonical" href="${canonical}" />`,
    structuredData ? `<script type="application/ld+json">${JSON.stringify(structuredData).replace(/</g, "\\u003c")}</script>` : ""
  ].filter(Boolean).join("\n");
  const html = template
    .replace("<!--app-html-->", appHtml)
    .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace("</head>", `<meta name="description" content="${escapeHtml(description)}" />\n${socialMeta}\n</head>`);
  const target = htmlPathForRoute(route);
  await ensureDir(path.dirname(target));
  await fs.writeFile(target, html, "utf8");
};

const writeFeeds = async (site: SiteData) => {
  const urls = allRoutes(site)
    .filter((route) => route.kind !== "not-found")
    .map((route) => {
      const lastModified = route.kind === "post" ? route.post.meta.updated || route.post.meta.date : undefined;
      return `<url><loc>${new URL(routePath(route), siteUrl).href}</loc>${lastModified ? `<lastmod>${lastModified}</lastmod>` : ""}</url>`;
    })
    .join("");
  await fs.writeFile(path.join(distDir, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, "utf8");

  const feedUrl = new URL("/rss.xml", siteUrl).href;
  const items = site.posts
    .slice(0, 30)
    .map((post) => {
      const link = new URL(`/blog/${post.meta.slug}/`, siteUrl).href;
      return `<item><title>${escapeHtml(post.meta.title)}</title><link>${link}</link><guid>${link}</guid><pubDate>${new Date(post.meta.date).toUTCString()}</pubDate><description>${escapeHtml(post.plainText.slice(0, 180))}</description></item>`;
    })
    .join("");
  const channelMeta = [
    `<title>${escapeHtml(siteTitle)}</title>`,
    `<link>${siteUrl}</link>`,
    `<description>${escapeHtml(siteDescription)}</description>`,
    "<language>zh-cn</language>",
    `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    `<atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>`
  ].join("");
  await fs.writeFile(
    path.join(distDir, "rss.xml"),
    `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>${channelMeta}${items}</channel></rss>`,
    "utf8"
  );

  const llms = [
    `# ${siteTitle}`,
    "",
    `> ${siteDescription}`,
    "",
    "## 文章",
    "",
    ...site.posts.map((post) => {
      const link = new URL(`/blog/${post.meta.slug}/`, siteUrl).href;
      return `- [${post.meta.title}](${link})：${post.plainText.slice(0, 80)}`;
    }),
    "",
    "## 其他",
    "",
    `- [RSS](${feedUrl})：订阅更新`,
    ""
  ].join("\n");
  await fs.writeFile(path.join(distDir, "llms.txt"), llms, "utf8");
  await fs.writeFile(path.join(distDir, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${new URL("/sitemap.xml", siteUrl).href}\n`, "utf8");
};

const build = async () => {
  const site = await loadSite();
  console.log(`Publishing ${site.posts.length} posts${process.env.INCLUDE_DRAFTS === "true" ? " including drafts" : " (drafts excluded)"}.`);
  await writeGeneratedData(site);
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.rm(ssrOutDir, { recursive: true, force: true });

  await viteBuild({ build: { outDir: distDir, emptyOutDir: true } });

  const template = await fs.readFile(path.join(distDir, "index.html"), "utf8");
  const serverEntry = pathToFileURL(path.join(ssrOutDir, "server.js")).href;
  await viteBuild({
    build: {
      ssr: "src/server.tsx",
      outDir: ssrOutDir,
      emptyOutDir: true,
      rollupOptions: {
        output: { entryFileNames: "server.js" }
      }
    }
  });
  const { render } = await import(`${serverEntry}?v=${Date.now()}`);

  await Promise.all(allRoutes(site).map((route) => renderPage(route, template, render)));
  await writeFeeds(site);
  await writePublishAttributes();
  await fs.writeFile(path.join(distDir, ".nojekyll"), "", "utf8");
  await fs.rm(ssrOutDir, { recursive: true, force: true });
};

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
