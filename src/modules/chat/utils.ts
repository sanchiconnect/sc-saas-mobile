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

// Uploaded chat attachments come back as S3 presigned URLs stored as the
// message body — e.g. `https://s3.ap-south-1.amazonaws.com/.../files/abc.png?X-Amz-...`.
// On web these render as proper image/video previews; on mobile we need to
// detect the URL, classify by extension, and surface a basename so we can
// show the same preview UI here.
export type AttachmentKind = 'image' | 'video' | 'file';

export type AttachmentInfo = {
  kind: AttachmentKind;
  url: string;
  fileName: string;
};

const URL_RE = /https?:\/\/[^\s<>"']+/i;
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|heic|heif|bmp|svg)(?:$|\?)/i;
const VIDEO_EXT_RE = /\.(mp4|mov|m4v|webm|avi|mkv|3gp)(?:$|\?)/i;
// URI schemes we accept as a `fileUrl` value. http(s) are server URLs;
// file://, content://, ph://, assets-library:// are local device URIs from
// the image / document pickers — these render fine in <Image>/<Video> on
// both platforms and let an optimistic message preview the picked asset
// instantly, before the upload completes and the server's presigned URL
// roundtrips back.
const URI_SCHEME_RE =
  /^(?:https?|file|content|ph|assets-library):\/\//i;

// Resolve attachment info from a Message. The backend's wire shape varies
// between code paths: the upload-response message returns the asset URL in
// `fileUrl` and the human-readable name in `message`; the list-refetch
// version inlines the presigned URL directly into `message`. We accept
// either so the bubble renders consistently in both states.
export const getAttachmentInfo = (
  rawMessage: string | null | undefined,
  messageType?: string,
  fileUrl?: string | null,
): AttachmentInfo | null => {
  let url: string | null = null;

  // Prefer the explicit `fileUrl` field when present — it is the canonical
  // asset location and is unambiguous about what to show. Accept local URI
  // schemes too so an optimistic message can render the picked file
  // immediately, before the upload finishes.
  if (fileUrl && URI_SCHEME_RE.test(fileUrl.trim())) {
    url = fileUrl.trim();
  } else if (rawMessage) {
    // Fall back to extracting an http(s) URL from the message body itself.
    // Body may carry HTML wrappers from older threads — strip those first
    // so the URL regex doesn't trip on a trailing `</p>` etc.
    const plain = stripHtml(rawMessage);
    const match = plain.match(URL_RE);
    if (match) url = match[0];
  }

  if (!url) return null;

  // If the message body carries a friendly filename (the upload-response
  // shape), prefer it over the URL's opaque basename. Skip when the body
  // is itself the URL or empty.
  let fileName = 'Attachment';
  const plainBody = rawMessage ? stripHtml(rawMessage).trim() : '';
  if (
    plainBody &&
    plainBody.length < 200 &&
    !URI_SCHEME_RE.test(plainBody)
  ) {
    fileName = plainBody;
  } else {
    try {
      const pathOnly = url.split('?')[0];
      const lastSegment = pathOnly.substring(pathOnly.lastIndexOf('/') + 1);
      if (lastSegment) fileName = decodeURIComponent(lastSegment);
    } catch {
      // Leave the default.
    }
  }

  let kind: AttachmentKind;
  if (IMAGE_EXT_RE.test(url) || messageType === 'image') {
    kind = 'image';
  } else if (VIDEO_EXT_RE.test(url) || messageType === 'video') {
    kind = 'video';
  } else {
    kind = 'file';
  }

  return {kind, url, fileName};
};

// Different code paths flag soft-deleted messages with different field
// names — local optimistic updates use `isDeleted`, the REST refetch may
// return `is_deleted` (snake_case) or a `deletedAt` timestamp. Check them
// all so the tombstone bubble survives a refresh.
export const isMessageDeleted = (
  message: {
    isDeleted?: boolean;
    [key: string]: unknown;
  } | null | undefined,
): boolean => {
  if (!message) return false;
  const m = message as Record<string, unknown>;
  return Boolean(
    m.isDeleted ||
      m.is_deleted ||
      m.deleted ||
      m.deletedAt ||
      m.deleted_at,
  );
};
