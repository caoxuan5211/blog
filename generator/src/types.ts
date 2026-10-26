export type Theme = "dark" | "light";

export type PostMeta = {
  title: string;
  date: string;
  updated: string;
  draft: boolean;
  tags: string[];
  slug: string;
  sourcePath: string;
  readingTime: number;
  cover?: {
    image: string;
    alt?: string;
    relative?: boolean;
  };
};

export type PostDocument = {
  meta: PostMeta;
  html: string;
  plainText: string;
};

export type TagSummary = {
  slug: string;
  name: string;
  count: number;
};

export type SiteData = {
  posts: PostDocument[];
  tags: TagSummary[];
};

export type RouteData =
  | { kind: "home"; site: SiteData }
  | { kind: "tags"; site: SiteData }
  | { kind: "tag"; site: SiteData; tag: string }
  | { kind: "post"; site: SiteData; post: PostDocument }
  | { kind: "not-found"; site: SiteData };
