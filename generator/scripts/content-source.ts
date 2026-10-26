import path from "node:path";
import matter from "gray-matter";
import remarkParse from "remark-parse";
import { parse as parseToml } from "smol-toml";
import { unified } from "unified";

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
  const tree = unified().use(remarkParse).parse(parsed.content) as any;
  const heading = tree.children?.find((node: any) => node.type === "heading" && node.depth === 1);
  const headingText = (node: any): string => {
    if (typeof node?.value === "string") return node.value;
    return Array.isArray(node?.children) ? node.children.map(headingText).join("") : "";
  };
  const start = heading?.position?.start?.offset;
  const end = heading?.position?.end?.offset;
  const body = typeof start === "number" && typeof end === "number"
    ? parsed.content.slice(0, start) + parsed.content.slice(end).replace(/^(?:\r?\n)+/, "")
    : parsed.content;
  return {
    data: parsed.data,
    title: String(parsed.data.title || headingText(heading) || fallbackTitle).trim(),
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
