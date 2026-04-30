import {
  AdvisoryMember,
  BasicInfoForm,
  EMPTY_BASIC_INFO,
  SocialLinks,
  TeamMember,
} from './types';

type AnyRecord = Record<string, any>;

const pickFirst = (...candidates: any[]) => {
  for (const value of candidates) {
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
};

const asString = (value: any): string =>
  value === undefined || value === null ? '' : String(value);

const randomId = () =>
  `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const resolveLogoUrl = (
  avatar: string | undefined | null,
  baseUrl: string | undefined,
): string | null => {
  if (!avatar) return null;
  // Already absolute? Use as-is.
  if (/^https?:\/\//i.test(avatar)) return avatar;
  if (!baseUrl) return null;
  return `${baseUrl.replace(/\/$/, '')}/${avatar.replace(/^\//, '')}`;
};

const toLeadership = (raw: any): TeamMember[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map(item => ({
    id: asString(item?.id || item?._id) || randomId(),
    name: asString(pickFirst(item?.name, item?.fullName)),
    linkedinUrl: asString(
      pickFirst(item?.linkedinUrl, item?.linkedin, item?.linkedInUrl),
    ),
    role: asString(pickFirst(item?.role, item?.type, item?.accountRole)),
    designation: asString(pickFirst(item?.designation, item?.title)),
  }));
};

const toAdvisory = (raw: any): AdvisoryMember[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map(item => ({
    id: asString(item?.id || item?._id) || randomId(),
    name: asString(pickFirst(item?.name, item?.fullName)),
    linkedinUrl: asString(
      pickFirst(item?.linkedinUrl, item?.linkedin, item?.linkedInUrl),
    ),
  }));
};

const toSocial = (root: AnyRecord, social: AnyRecord): SocialLinks => ({
  website: asString(pickFirst(social?.website, social?.websiteUrl, root?.websiteUrl, root?.website)),
  linkedin: asString(
    pickFirst(
      social?.linkedin,
      social?.linkedinUrl,
      root?.linkedInUrl,
      root?.linkedinUrl,
    ),
  ),
  twitter: asString(
    pickFirst(
      social?.twitter,
      social?.twitterUrl,
      social?.x,
      root?.twitterUrl,
    ),
  ),
  youtube: asString(pickFirst(social?.youtube, social?.youtubeUrl, root?.youtubeUrl)),
  facebook: asString(pickFirst(social?.facebook, social?.facebookUrl, root?.facebookUrl)),
  instagram: asString(pickFirst(social?.instagram, social?.instagramUrl, root?.instagramUrl)),
});

export type ExtractedProfile = {
  basicInfo: BasicInfoForm;
  profileCompletion: number;
  raw: AnyRecord;
};

/**
 * Parses the /api/v1/users/profile response into the BasicInfoForm shape.
 *
 * The endpoint returns a flat user object under `data` (no nested company),
 * with `profileName` as the company name and `avatar` as a relative logo path.
 * Pass `logoBaseUrl` (the tenant imgKit URL) so we can resolve the avatar to
 * a full URL.
 */
export const extractProfile = (
  data: AnyRecord,
  logoBaseUrl?: string,
): ExtractedProfile => {
  const root = data?.data || data || {};

  // Some deployments may nest the startup detail; fall back to root for the
  // common case where the user object is the entry point.
  const company =
    root?.company ||
    root?.startup ||
    root?.organization ||
    root;
  const address =
    company?.address ||
    company?.headquarters ||
    root?.address ||
    {};
  const social = root?.social || root?.socialLinks || company?.social || {};

  const incorporatedRaw = pickFirst(
    company?.isIncorporated,
    company?.incorporated,
    root?.isIncorporated,
  );

  const businessModelsRaw = pickFirst(
    company?.businessModels,
    root?.businessModels,
  );

  const basicInfo: BasicInfoForm = {
    ...EMPTY_BASIC_INFO,

    companyName: asString(
      pickFirst(
        root?.profileName,
        company?.name,
        company?.companyName,
        root?.companyName,
        root?.organizationName,
        root?.otherCompanyName,
      ),
    ),
    companySize: asString(
      pickFirst(
        company?.size,
        company?.teamSize,
        company?.companySize,
        root?.companySize,
      ),
    ),
    isIncorporated:
      typeof incorporatedRaw === 'boolean' ? incorporatedRaw : null,
    logoUrl: resolveLogoUrl(
      asString(
        pickFirst(
          root?.avatar,
          company?.logo,
          company?.logoUrl,
          root?.logo,
          root?.logoUrl,
        ),
      ) || null,
      logoBaseUrl,
    ),

    country: asString(pickFirst(address?.country, root?.country)),
    state: asString(pickFirst(address?.state, root?.state)),
    city: asString(pickFirst(address?.city, company?.city, root?.city)),

    elevatorPitch: asString(
      pickFirst(company?.elevatorPitch, root?.elevatorPitch, company?.pitch),
    ),
    companyBrief: asString(
      pickFirst(company?.brief, root?.companyBrief, company?.description),
    ),

    productStage: asString(
      pickFirst(company?.productStage, root?.productStage, company?.stage),
    ),
    businessModels: Array.isArray(businessModelsRaw)
      ? businessModelsRaw.map(asString).filter(Boolean)
      : [],

    leadership: toLeadership(
      pickFirst(
        root?.leadership,
        root?.leadershipTeam,
        company?.leadership,
        company?.team,
      ),
    ),
    advisory: toAdvisory(
      pickFirst(
        root?.advisory,
        root?.advisoryBoard,
        company?.advisory,
        company?.advisoryBoard,
      ),
    ),

    social: toSocial(root, social),
  };

  // If the leadership array is empty but the response includes a primary user
  // who looks like a founder, surface them as the first leadership entry so
  // the form shows the current user immediately.
  if (
    basicInfo.leadership.length === 0 &&
    (root?.name || root?.email) &&
    (root?.accountRole || root?.designation || root?.isCEO)
  ) {
    basicInfo.leadership = [
      {
        id: asString(root?.id || root?.uuid) || randomId(),
        name: asString(root?.name),
        linkedinUrl: asString(root?.linkedInUrl || root?.linkedinUrl),
        role: asString(root?.accountRole),
        designation: asString(root?.designation),
      },
    ];
  }

  const completionRaw = pickFirst(
    data?.data?.profileCompletion,
    data?.data?.completion,
    data?.profileCompletion,
    data?.completion,
    root?.profileCompletion,
  );
  const completion = Number(completionRaw);
  const profileCompletion = Number.isFinite(completion) ? completion : 0;

  return {basicInfo, profileCompletion, raw: data};
};

export const buildBasicInfoPayload = (info: BasicInfoForm) => ({
  profileName: info.companyName,
  company: {
    name: info.companyName,
    size: info.companySize,
    isIncorporated: info.isIncorporated,
    elevatorPitch: info.elevatorPitch,
    brief: info.companyBrief,
    productStage: info.productStage,
    businessModels: info.businessModels,
    address: {
      country: info.country,
      state: info.state,
      city: info.city,
    },
  },
  leadership: info.leadership.map(({id: _id, ...rest}) => rest),
  advisory: info.advisory.map(({id: _id, ...rest}) => rest),
  social: info.social,
  // Top-level mirrors so backends that expect flat fields also receive them.
  linkedInUrl: info.social.linkedin,
  twitterUrl: info.social.twitter,
});
