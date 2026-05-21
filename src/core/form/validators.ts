// Reusable form validators. Each validator takes a value and returns either
// `undefined` (valid) or an error message string. Compose with `combine()`.

export type Validator<T = string> = (value: T) => string | undefined;

// RFC-5322-ish — pragmatic, not exhaustive. Mirrors the frontend's check.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Pragmatic URL — accepts http(s) prefix OR a bare domain like frontend's
// `URL_REGEX` in shared/constants/regex.ts (allows e.g. "sanchiconnect.com").
const URL_RE = /^(https?:\/\/)?[\da-z.-]+\.[a-z.]{2,6}([/?#][^\s]*)?$/i;

// Platform-specific URL regexes — mirror frontend's shared/constants/regex.ts.
const LINKEDIN_RE = /^((https?:)?\/\/)?[a-z.]*linkedin\.com\/.+$/i;
const TWITTER_RE = /^https?:\/\/(www\.)?(twitter|x)\.com\/[a-zA-Z0-9_]+/i;
const FACEBOOK_RE = /^(https?:\/\/)?(www\.)?facebook\.com\/(profile\.php\?id=\d+|[a-zA-Z0-9./]+)$/i;
const YOUTUBE_RE = /^(https?:\/\/)?(www\.)?youtube\.com\/(channel\/[a-zA-Z0-9_-]+|user\/[a-zA-Z0-9_-]+|c\/[a-zA-Z0-9_-]+|@?[a-zA-Z0-9_-]+)\/?$/i;
const INSTAGRAM_RE = /^(https?:\/\/)?(www\.)?instagram\.com\/[a-zA-Z0-9._]+\/?$/i;

export const required =
  (label: string = 'This field'): Validator =>
  value => {
    const trimmed = String(value ?? '').trim();
    return trimmed.length === 0 ? `${label} is required.` : undefined;
  };

export const email: Validator = value => {
  const trimmed = String(value ?? '').trim();
  if (trimmed.length === 0) return undefined; // pair with `required` if needed
  return EMAIL_RE.test(trimmed)
    ? undefined
    : 'Please enter a valid email address.';
};

export const url: Validator = value => {
  const trimmed = String(value ?? '').trim();
  if (trimmed.length === 0) return undefined;
  return URL_RE.test(trimmed) ? undefined : 'Please enter a valid URL.';
};

const platformUrl =
  (re: RegExp, name: string): Validator =>
  value => {
    const trimmed = String(value ?? '').trim();
    if (trimmed.length === 0) return undefined;
    return re.test(trimmed) ? undefined : `Please enter a valid ${name} URL.`;
  };

export const linkedinUrl = platformUrl(LINKEDIN_RE, 'LinkedIn');
export const twitterUrl = platformUrl(TWITTER_RE, 'X/Twitter');
export const facebookUrl = platformUrl(FACEBOOK_RE, 'Facebook');
export const youtubeUrl = platformUrl(YOUTUBE_RE, 'YouTube');
export const instagramUrl = platformUrl(INSTAGRAM_RE, 'Instagram');

// Indian-style 10-digit mobile by default; tweak `min`/`max` for global.
export const mobileNumber = (min = 7, max = 15): Validator => value => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 0) return undefined;
  if (digits.length < min) return `Mobile number is too short.`;
  if (digits.length > max) return `Mobile number is too long.`;
  return undefined;
};

export const minLength =
  (n: number, label = 'This field'): Validator =>
  value => {
    const trimmed = String(value ?? '').trim();
    if (trimmed.length === 0) return undefined;
    return trimmed.length < n
      ? `${label} must be at least ${n} characters.`
      : undefined;
  };

export const maxLength =
  (n: number, label = 'This field'): Validator =>
  value => {
    const text = String(value ?? '');
    return text.length > n
      ? `${label} must be ${n} characters or fewer.`
      : undefined;
  };

export const exactLength =
  (n: number, label = 'This field'): Validator =>
  value => {
    const trimmed = String(value ?? '').trim();
    if (trimmed.length === 0) return undefined;
    return trimmed.length !== n
      ? `${label} must be exactly ${n} characters.`
      : undefined;
  };

// Digits-only with exact length (e.g. OTP). Empty → no error.
export const digitsOfLength =
  (n: number): Validator =>
  value => {
    const trimmed = String(value ?? '').trim();
    if (trimmed.length === 0) return undefined;
    if (!/^\d+$/.test(trimmed)) return 'Only digits are allowed.';
    return trimmed.length !== n
      ? `Must be ${n} digits.`
      : undefined;
  };

// Compose: first failing validator wins.
export const combine =
  (...validators: Validator[]): Validator =>
  value => {
    for (const v of validators) {
      const err = v(value);
      if (err) return err;
    }
    return undefined;
  };
