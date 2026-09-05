/**
 * Compare meal names alphabetically while ignoring leading punctuation and
 * symbols, so a meal like `« Sushis » au thon` sorts under "S", not with the
 * special characters at the top of the list.
 */
export function compareMealNames(a: string, b: string): number {
  return sortKey(a).localeCompare(sortKey(b), "fr");
}

function sortKey(name: string): string {
  // Drop everything up to the first letter or digit (quotes, guillemets,
  // dashes, spaces, …), then strip remaining symbols so inner punctuation
  // doesn't reorder otherwise-equal names.
  return name
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
}
