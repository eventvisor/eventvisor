export const HISTORY_VISIBLE_ENTITY_LIMIT = 10;

export function formatHistoryTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function getHistoryCommitUrl(template: string | undefined, commit: string) {
  return template?.replace(/{{(?:commit|hash)}}/, commit);
}
