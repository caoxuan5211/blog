import type { EvidenceDocument, RouteData, SiteData } from "./types";

export const siteTitle = "soken";
export const siteDescription = "算法笔记、工程记录、日常备忘。";
export const siteUrl = "https://mineguai.com";

export const routePath = (route: RouteData): string => {
  if (route.kind === "home") return "/";
  if (route.kind === "dossier") return "/dossier/";
  if (route.kind === "clues") return "/clues/";
  if (route.kind === "clue") return `/clues/${route.clue}/`;
  if (route.kind === "evidence") return `/evidence/${route.evidence.meta.slug}/`;
  return "/404.html";
};

export const evidencePath = (evidence: EvidenceDocument): string =>
  `/evidence/${evidence.meta.slug}/`;

export const cluePath = (slug: string): string => `/clues/${slug}/`;

export const allRoutes = (site: SiteData): RouteData[] => [
  { kind: "home", site },
  { kind: "dossier", site },
  { kind: "clues", site },
  ...site.clues.map((clue) => ({ kind: "clue" as const, site, clue: clue.slug })),
  ...site.evidences.map((evidence) => ({ kind: "evidence" as const, site, evidence })),
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
  if (normalized === "/dossier/") return { kind: "dossier", site };
  if (normalized === "/clues/") return { kind: "clues", site };

  const evidenceMatch = normalized.match(/^\/evidence\/(.+)\/$/);
  if (evidenceMatch) {
    const slug = normalizeSlug(evidenceMatch[1]);
    const evidence = site.evidences.find((item) => item.meta.slug === slug);
    if (evidence) return { kind: "evidence", site, evidence };
  }

  const clueMatch = normalized.match(/^\/clues\/(.+)\/$/);
  if (clueMatch) {
    const clue = normalizeSlug(clueMatch[1]);
    if (site.clues.some((item) => item.slug === clue)) return { kind: "clue", site, clue };
  }

  return { kind: "not-found", site };
};
