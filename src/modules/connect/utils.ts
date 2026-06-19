// Field resolvers for directory entries. The public-search payload shape
// varies per role and backend version, so every renderable field goes through
// a defensive resolver that checks the handful of keys that field shows up
// under. Mirrors (and extends) the logic in home/components/RecommendedCard.

import {stripHtml} from '../chat/utils';

const firstString = (...vals: unknown[]): string => {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v;
    if (typeof v === 'number') return String(v);
  }
  return '';
};

// The USER uuid — what connect / wishlist / chat key on. Prefer the explicit
// user-uuid fields; only fall back to the bare `uuid` (often the account uuid)
// when nothing better exists. The extra paths cover partner and service_provider
// search responses which may nest the user uuid under `user.uuid` or `users[0]`.
export const resolveUserUuid = (item: Record<string, any>): string =>
  firstString(
    item?.userUUID,
    item?.userUuid,
    item?.user?.uuid,
    item?.user?.userUUID,
    item?.users?.[0]?.uuid,
    item?.users?.[0]?.userUUID,
    item?.uuid,
    item?.id,
  );

// The account/profile uuid — what the role-specific detail endpoints key on
// (startup-information, forms-management, increment_views). Prefer the
// account-scoped uuids; fall back to the bare `uuid`, then the user uuid.
export const resolveProfileUuid = (item: Record<string, any>): string =>
  firstString(
    item?.startupUUID,
    item?.investorUUID,
    item?.mentorUUID,
    item?.corporateUUID,
    item?.serviceProviderUUID,
    item?.partnerUUID,
    item?.individualUUID,
    item?.programOfficeUUID,
    item?.profileUUID,
    item?.accountUUID,
    item?.uuid,
    item?.userUUID,
  );

export const resolveNumericId = (item: Record<string, any>): string =>
  firstString(item?.id, item?.userId, item?.user?.id);

export const resolveAccountType = (item: Record<string, any>): string =>
  firstString(item?.accountType, item?.account_type, item?.userAccountType);

export const resolveName = (item: Record<string, any>): string =>
  firstString(
    item?.companyName,
    item?.organizationName,
    item?.organisationName,
    item?.name,
    item?.fullName,
    item?.user?.fullName,
  ) || 'Untitled';

// Short descriptive line under the name. Bios come back as Quill HTML, so we
// strip to plain text before truncating.
export const resolveHeadline = (item: Record<string, any>): string => {
  const raw = firstString(
    item?.shortDescription,
    item?.briefDescription,
    item?.elevatorPitch,
    item?.tagline,
    item?.aboutUs,
    item?.description,
    item?.bio,
  );
  return stripHtml(raw).slice(0, 140);
};

export const resolveCity = (item: Record<string, any>): string => {
  const city =
    item?.registeredCity?.name ||
    item?.city?.name ||
    item?.city ||
    item?.registeredCity ||
    item?.location ||
    '';
  return typeof city === 'string' ? city : '';
};

export const resolveCountry = (item: Record<string, any>): string => {
  const country =
    item?.registeredCountry?.name ||
    item?.country?.name ||
    item?.country ||
    '';
  return typeof country === 'string' ? country : '';
};

// Up to `limit` short tag labels (industries / sectors / stages) for the chip
// row at the bottom of a card.
export const resolveTags = (
  item: Record<string, any>,
  limit = 3,
): string[] => {
  const lists = [
    item?.sectoralInterests,
    item?.startupIndustries,
    item?.industries,
    item?.investmentStages,
    item?.fundingStages,
    item?.domains,
    item?.expertise,
  ];
  const out: string[] = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const x of list) {
      const label = firstString(x?.name, x?.label, x?.title, x);
      if (label && !out.includes(label)) out.push(label);
      if (out.length >= limit) return out;
    }
  }
  return out;
};

// Resolve a (possibly relative) logo/avatar path into an absolute URL against
// the tenant imgKit base. Already-absolute http(s) values pass through.
export const resolveLogo = (
  item: Record<string, any>,
  baseUrl?: string,
): string | null => {
  const raw = firstString(
    item?.companyLogo,
    item?.organizationLogo,
    item?.logo,
    item?.avatar,
    item?.profilePicture,
    item?.profileImage,
  );
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!baseUrl) return null;
  return `${baseUrl.replace(/\/$/, '')}/${raw.replace(/^\//, '')}`;
};

export const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts.slice(0, 2).map(n => n[0]).join('').toUpperCase();
};

// "23400" → "23.4K". Mirrors the web numberFormatter used on funding figures.
export const formatNumber = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return 'N/A';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  if (Math.abs(num) >= 1_000_000_000)
    return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
};

// Stringify a value that might be a string, array, or list of {name} objects.
export const joinList = (value: unknown): string => {
  if (!value) return 'N/A';
  if (Array.isArray(value)) {
    const parts = value
      .map(v => firstString((v as any)?.name, (v as any)?.label, v))
      .filter(Boolean);
    return parts.length ? parts.join(', ') : 'N/A';
  }
  if (typeof value === 'object') {
    return firstString((value as any)?.name, (value as any)?.label) || 'N/A';
  }
  return String(value);
};
