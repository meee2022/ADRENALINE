/**
 * Standard text normalization for every in-app search.
 * Latin letter case, spacing and common separators never change the result.
 */
export function normalizeSearchText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s._-]+/g, "");
}

export function matchesSearchQuery(query: unknown, ...values: unknown[]): boolean {
  const needle = normalizeSearchText(query);
  if (!needle) return true;
  return values.some((value) => normalizeSearchText(value).includes(needle));
}
