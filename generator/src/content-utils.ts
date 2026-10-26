import type { PostDocument } from "./types";

export const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai"
  }).format(date);
};

export const formatPostDates = (date: string, updated: string): { published: string; modified?: string } => {
  const published = formatDate(date);
  if (new Date(updated).getTime() === new Date(date).getTime()) return { published };
  return { published, modified: formatDate(updated) };
};

export const shortTitle = (title: string, max = 18): string => {
  const chars = Array.from(title.trim());
  if (chars.length <= max) return chars.join("");
  return `${chars.slice(0, max).join("")}…`;
};

export const byNewest = (items: PostDocument[]): PostDocument[] =>
  [...items].sort((left, right) => {
    const leftTime = new Date(left.meta.date).getTime();
    const rightTime = new Date(right.meta.date).getTime();
    return rightTime - leftTime;
  });

export const estimateReadLabel = (minutes: number): string =>
  `${Math.max(1, Math.round(minutes))} 分钟`;
