// A file's full address, worked out from the page's own address.
//
// Why this exists: a relative address written into a CSS variable is read by
// Chrome against the stylesheet that uses the variable (assets/…css), not
// against the page. The part sketches were asked for at assets/sketches/…,
// which isn't there, so the picture never showed. A full address has one
// meaning wherever it is used.
export function pageUrl(path: string, base: string): string {
  return new URL(path, base).href
}
