import type { EntitySummary } from "./types";

export function parseQuery(query: string) {
  const terms: string[] = [];
  const qualifiers: Array<{ key: string; value: string }> = [];
  const matcher = /(?:(\w+):"([^"]+)")|(?:(\w+):([^\s]+))|(?:"([^"]+)")|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(query))) {
    const key = match[1] || match[3];
    const value = match[2] || match[4];
    if (key && value) qualifiers.push({ key: key.toLowerCase(), value: value.toLowerCase() });
    else if (match[5] || match[6]) terms.push((match[5] || match[6]).toLowerCase());
  }
  return { terms, qualifiers };
}

function includes(values: string[] | undefined, value: string) {
  return (values || []).some((item) => item.toLowerCase() === value);
}

function matchesQualifier(entity: EntitySummary, key: string, value: string) {
  if (key === "tag") return includes(entity.tags, value);
  if (key === "target") return includes(entity.targets, value);
  if (key === "archived") return String(Boolean(entity.archived)) === value;
  if (key === "deprecated") return String(Boolean(entity.deprecated)) === value;
  if (key === "type") return (entity.schemaType || "").toLowerCase() === value;
  if (key === "level") return (entity.level || "").toLowerCase() === value;
  if (key === "transport") return (entity.transport || "").toLowerCase() === value;
  return false;
}

export function createQueryMatcher(query: string) {
  const parsed = parseQuery(query.trim().toLowerCase());
  return (entity: EntitySummary) => {
    if (!parsed.qualifiers.every(({ key, value }) => matchesQualifier(entity, key, value)))
      return false;
    const haystack = [
      entity.key,
      entity.description || "",
      entity.schemaType || "",
      entity.level || "",
      entity.transport || "",
      ...(entity.tags || []),
      ...(entity.targets || []),
    ]
      .join(" ")
      .toLowerCase();
    return parsed.terms.every((term) => haystack.includes(term));
  };
}

export function matchesQuery(entity: EntitySummary, query: string) {
  return createQueryMatcher(query)(entity);
}
