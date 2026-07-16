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

// Structured payload carried by chat messages whose `messageType === 'meeting'`
// — emitted both by the backend when a connection is accepted with a
// scheduled video call AND by the Connections screen's accept flow on
// mobile (which prefixes the body with `__MEETING__{json}__\n<fallback>`
// for backward compat with clients that don't read messageType).
//
// Field shape mirrors what the web app's meeting-card consumes; extras
// (participants names etc.) are best-effort and rendered when present.
export type MeetingPayload = {
  type: 'meeting';
  duration?: number;
  date?: string;
  time?: string;
  title?: string;
  meetingUUID?: string;
};

const MEETING_MARKER_RE =
  /^__MEETING__(\{[\s\S]*?\})__(?:\r?\n([\s\S]*))?$/;

// The backend's auto-emitted meeting message may key date/time/title fields
// the same way the create-meeting request does (`meetingTitle`, `timeFrom`)
// rather than the card's plain `title`/`time` — try every known alias before
// giving up, same defensive style as resolveUserUuid/resolveProfileUuid in
// connect/utils.ts.
const normalizeMeetingPayload = (parsed: Record<string, any>): MeetingPayload => ({
  type: 'meeting',
  title: parsed?.title || parsed?.meetingTitle || parsed?.name || undefined,
  date:
    parsed?.date ||
    parsed?.meetingDate ||
    parsed?.scheduledDate ||
    parsed?.startDate ||
    undefined,
  time:
    parsed?.time ||
    parsed?.meetingTime ||
    parsed?.startTime ||
    parsed?.timeFrom ||
    undefined,
  duration: parsed?.duration,
  meetingUUID: parsed?.meetingUUID || parsed?.meetingUuid || undefined,
});

// Extract meeting metadata from a message. Priority order:
//   0. `messageType === 'meeting'` + a `metadata` object     →  use that.
//      Confirmed shape (GET /api/v1/chat/message):
//      {date, timeFrom, timeTo, meetingUUID, meetingTitle} — `message` is
//      just a plain label ("Meeting scheduled"), never JSON.
//   1. `messageType === 'meeting'` + a parseable JSON body  →  use that.
//   2. `messageType === 'meeting'` + body without JSON      →  surface
//      whatever fields can be inferred (often just the body as fallback
//      text).
//   3. Body starts with `__MEETING__{json}__\n<fallback>` (mobile-emitted
//      format)                                              →  parse.
//   4. Neither of the above                                 →  null.
// Returning null lets the caller fall through to the regular text bubble.
export const parseMeetingMarker = (
  rawMessage: string | null | undefined,
  messageType?: string | null,
  metadata?: Record<string, any> | null,
): {meeting: MeetingPayload; fallback: string} | null => {
  const isMeetingType =
    typeof messageType === 'string' &&
    messageType.toLowerCase() === 'meeting';

  if (isMeetingType && metadata && typeof metadata === 'object') {
    return {
      meeting: normalizeMeetingPayload(metadata),
      fallback: stripHtml(rawMessage).trim(),
    };
  }

  // Case 1 & 2: messageType says it's a meeting. Try to parse JSON out of
  // the body (whole body, then marker-wrapped, then give up gracefully).
  if (isMeetingType) {
    const plain = stripHtml(rawMessage);
    // 1a. Whole body is JSON.
    const trimmed = plain.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        return {
          meeting: normalizeMeetingPayload(parsed),
          fallback: '',
        };
      } catch {
        // Fall through to marker / fallback handling.
      }
    }
    // 1b. Body is `__MEETING__{json}__\n<fallback>`.
    const marker = plain.match(MEETING_MARKER_RE);
    if (marker) {
      try {
        const parsed = JSON.parse(marker[1]);
        return {
          meeting: normalizeMeetingPayload(parsed),
          fallback: (marker[2] || '').trim(),
        };
      } catch {
        // Fall through to bare-fallback.
      }
    }
    // 2. messageType is 'meeting' but we couldn't parse details — still
    // render the card with the body as fallback text so the user sees
    // SOMETHING (better than a blank bubble).
    return {
      meeting: {type: 'meeting'},
      fallback: plain.trim(),
    };
  }

  // Case 3: marker-only path (legacy / older messages without messageType).
  if (!rawMessage) return null;
  const plain = stripHtml(rawMessage);
  const match = plain.match(MEETING_MARKER_RE);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (parsed?.type !== 'meeting') return null;
    return {meeting: normalizeMeetingPayload(parsed), fallback: (match[2] || '').trim()};
  } catch {
    return null;
  }
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
