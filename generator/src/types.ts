export type Theme = "dark" | "light";

export type EvidenceMeta = {
  title: string;
  date: string;
  updated: string;
  draft: boolean;
  tags: string[];
  categories: string[];
  clues: string[];
  slug: string;
  sourcePath: string;
  readingTime: number;
  cover?: {
    image: string;
    alt?: string;
    relative?: boolean;
  };
};

export type EvidenceDocument = {
  meta: EvidenceMeta;
  html: string;
  plainText: string;
};

export type SiteData = {
  evidences: EvidenceDocument[];
  clues: Array<{
    slug: string;
    name: string;
    count: number;
  }>;
};

export type RouteData =
  | { kind: "home"; site: SiteData }
  | { kind: "dossier"; site: SiteData }
  | { kind: "clues"; site: SiteData }
  | { kind: "clue"; site: SiteData; clue: string }
  | { kind: "evidence"; site: SiteData; evidence: EvidenceDocument }
  | { kind: "not-found"; site: SiteData };
