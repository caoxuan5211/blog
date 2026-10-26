export type Theme = "dark" | "light";

export type PostMeta = {
  title: string;
  date: string;
  updated: string;
  draft: boolean;
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

export type SiteData = {
  posts: PostDocument[];
};

export type RouteData =
  | { kind: "home"; site: SiteData }
  | { kind: "post"; site: SiteData; post: PostDocument }
  | { kind: "not-found"; site: SiteData };
