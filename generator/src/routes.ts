import type { PostDocument, RouteData, SiteData } from "./types";

export const siteTitle = "soken";
export const siteDescription = "算法笔记、工程记录、日常备忘。";
export const siteUrl = "https://mineguai.com";

export const routePath = (route: RouteData): string => {
  if (route.kind === "home") return "/";
  if (route.kind === "post") return `/blog/${route.post.meta.slug}/`;
  return "/404.html";
};

export const postPath = (post: PostDocument): string => `/blog/${post.meta.slug}/`;

export const allRoutes = (site: SiteData): RouteData[] => [
  { kind: "home", site },
  ...site.posts.map((post) => ({ kind: "post" as const, site, post })),
  { kind: "not-found", site }
];

const normalizeSlug = (value: string): string =>
  value
    .split("/")
    .map((part) => encodeURIComponent(decodeURIComponent(part)))
    .join("/");

export const findRoute = (pathname: string, site: SiteData): RouteData => {
  const pathnameWithoutIndex = pathname.replace(/\/index\.html$/i, "/");
  const normalized = pathnameWithoutIndex.endsWith("/") ? pathnameWithoutIndex : `${pathnameWithoutIndex}/`;
  if (normalized === "/") return { kind: "home", site };
  const postMatch = normalized.match(/^\/blog\/(.+)\/$/);
  if (postMatch) {
    const slug = normalizeSlug(postMatch[1]);
    const post = site.posts.find((item) => item.meta.slug === slug);
    if (post) return { kind: "post", site, post };
  }

  return { kind: "not-found", site };
};
