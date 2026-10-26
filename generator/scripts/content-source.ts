export type FrontMatter = Record<string, unknown>;

export type PostSource = {
  data: FrontMatter;
  title: string;
  body: string;
};

const parseFrontMatter = (raw: string): { data: FrontMatter; content: string } => {
  if (raw.startsWith("+++")) {
    const match = raw.match(/^\+\+\+\r?\n([\s\S]*?)\r?\n\+\+\+\r?\n?/);
    if (!match) return { data: {}, content: raw };
    return {
      data: parseToml(match[1]) as FrontMatter,
      content: raw.slice(match[0].length)
    };
  }
  const parsed = matter(raw);
  return { data: parsed.data, content: parsed.content };
};

export const parsePostSource = (raw: string, fallbackTitle: string): PostSource => {
  const parsed = parseFrontMatter(raw);
  const heading = parsed.content.match(/^#\s+(.+?)\s*$/m);
  const body = heading
    ? parsed.content.slice(0, heading.index) + parsed.content.slice((heading.index || 0) + heading[0].length).replace(/^\r?\n/, "")
    : parsed.content;
  return {
    data: parsed.data,
    title: String(parsed.data.title || heading?.[1] || fallbackTitle).trim(),
    body
  };
};

export const slugifyPost = (file: string, contentDir: string): string => {
  const relative = path.relative(contentDir, file).replace(/\\/g, "/");
  return relative
    .replace(/\.md$/i, "")
    .split("/")
    .map((part) => encodeURIComponent(part.trim().toLowerCase().replace(/\s+/g, "-")))
    .join("/");
};
import path from "node:path";
import matter from "gray-matter";
import { parse as parseToml } from "smol-toml";

