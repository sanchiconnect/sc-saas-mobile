// Backend stores message bodies as HTML (the frontend renders them through a
// rich-text/Quill viewer). Mobile shows plain text bubbles, so strip tags
// down to a readable string with paragraph breaks preserved.
const ENTITY_MAP: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

export const stripHtml = (raw: string | null | undefined): string => {
  if (!raw) return '';
  return String(raw)
    // <p>...</p><p>...</p> → blank-line separator
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    // <br>, <br/>, <br /> → single newline
    .replace(/<br\s*\/?>/gi, '\n')
    // Drop all remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode the common entities Quill emits
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39|apos);/g, m => ENTITY_MAP[m] || m)
    // Collapse the runs of whitespace introduced by tag stripping
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
