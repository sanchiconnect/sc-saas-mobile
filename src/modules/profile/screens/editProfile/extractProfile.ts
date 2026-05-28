import {
  AdvisoryMember,
  BasicInfoForm,
  FinancialsForm,
  EMPTY_BASIC_INFO,
  EMPTY_FINANCIALS,
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

const asBoolean = (value: any, fallback = false): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', '1'].includes(normalized)) {
      return true;
    }
    if (['false', 'no', '0'].includes(normalized)) {
      return false;
    }
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  return fallback;
};

const normalizeIdentifier = (value: any): string => {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  return String(value).trim();
};

const asIdentifierArray = (value: any): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(item =>
      normalizeIdentifier(
        typeof item === 'string' || typeof item === 'number'
          ? item
          : pickFirst(item?.id, item?.value, item?.name, item?.label),
      ),
    )
    .filter(Boolean);
};

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
  return raw.map(item => {
    const uuid = asString(item?.uuid);
    return {
      id: asString(item?.id || item?._id) || randomId(),
      uuid: uuid || undefined,
      name: asString(pickFirst(item?.name, item?.fullName)),
      linkedinUrl: asString(
        pickFirst(item?.linkedinUrl, item?.linkedin, item?.linkedInUrl),
      ),
      role: asString(pickFirst(item?.role, item?.type, item?.accountRole)),
      designation: asString(pickFirst(item?.designation, item?.title)),
    };
  });
};

const toAdvisory = (raw: any): AdvisoryMember[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map(item => {
    const uuid = asString(item?.uuid);
    return {
      id: asString(item?.id || item?._id) || randomId(),
      uuid: uuid || undefined,
      name: asString(pickFirst(item?.name, item?.fullName)),
      linkedinUrl: asString(
        pickFirst(item?.linkedinUrl, item?.linkedin, item?.linkedInUrl),
      ),
    };
  });
};

const toSocial = (root: AnyRecord, social: AnyRecord): SocialLinks => ({
  website: asString(
    pickFirst(
      social?.website,
      social?.websiteUrl,
      root?.displayWebsite,
      root?.websiteUrl,
      root?.website,
    ),
  ),
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
  financials: FinancialsForm;
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
  const productInformation = root?.productInformation || {};
  const pitchDeck = root?.pitchDeck || {};
  const financialsRoot = root?.financials || {};

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
    root?.startupBusinessModels?.map((item: AnyRecord) => item?.name),
    company?.businessModels,
    root?.businessModels,
  );

  const basicInfo: BasicInfoForm = {
    ...EMPTY_BASIC_INFO,

    companyName: asString(
      pickFirst(
        root?.companyName,
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
        root?.companySize,
        company?.size,
        company?.teamSize,
        company?.companySize,
        root?.companySize,
      ),
    ),
    // Despite its name, the backend's `isNotRegistered` flag is used like an
    // `isIncorporated` boolean — when the user picks "Yes" it ships `true`,
    // when "No" it ships `false`. So we read it as-is (no negation). When
    // neither field is present we leave it null so the Yes/No row shows
    // nothing selected.
    isIncorporated:
      typeof incorporatedRaw === 'boolean'
        ? incorporatedRaw
        : typeof root?.isNotRegistered === 'boolean'
          ? root.isNotRegistered
          : null,
    incorporationYear: asString(
      pickFirst(
        root?.yearOfIncorporation,
        company?.incorporationYear,
        company?.yearOfIncorporation,
        root?.incorporationYear,
        root?.yearOfIncorporation,
      ),
    ),
    logoUrl: resolveLogoUrl(
      asString(
        pickFirst(
          root?.companyLogo,
          root?.avatar,
          company?.logo,
          company?.logoUrl,
          root?.logo,
          root?.logoUrl,
        ),
      ) || null,
      logoBaseUrl,
    ),
    servicesLookingFor: Array.isArray(root?.servicesLookingFor)
      ? root.servicesLookingFor.map(asString).filter(Boolean)
      : [],
    cinNumber: asString(pickFirst(root?.cinNumber, company?.cinNumber)),
    gstNumber: asString(pickFirst(root?.gstNumber, company?.gstNumber)),
    gstinVisible: Boolean(
      pickFirst(root?.gstNumber, company?.gstNumber),
    ),
    dpiitNumber: asString(
      pickFirst(root?.dpiitNumber, company?.dpiitNumber),
    ),
    dpiitVisible: Boolean(
      pickFirst(root?.dpiitNumber, company?.dpiitNumber),
    ),

    countryId: Number(root?.registeredCountryR?.id ?? root?.registeredCountryId) || null,
    country: asString(
      pickFirst(
        root?.registeredCountryR?.name,
        root?.registeredCountry,
        address?.country,
        root?.country,
      ),
    ),
    stateId: Number(root?.registeredStateR?.id ?? root?.registeredStateId) || null,
    state: asString(
      pickFirst(
        root?.registeredStateR?.name,
        root?.registeredState,
        address?.state,
        root?.state,
      ),
    ),
    cityId: Number(root?.registeredCityR?.id ?? root?.registeredCityId) || null,
    city: asString(
      pickFirst(
        root?.registeredCityR?.name,
        root?.registeredCity,
        address?.city,
        company?.city,
        root?.city,
      ),
    ),

    elevatorPitch: asString(
      pickFirst(
        pitchDeck?.elevatorPitch,
        company?.elevatorPitch,
        root?.elevatorPitch,
        company?.pitch,
      ),
    ),
    companyBrief: asString(
      pickFirst(
        productInformation?.description,
        company?.brief,
        root?.companyBrief,
        company?.description,
      ),
    ),

    productStage: asString(
      pickFirst(
        productInformation?.productStage?.name,
        company?.productStage,
        root?.productStage,
        company?.stage,
      ),
    ),
    businessModels: Array.isArray(businessModelsRaw)
      ? businessModelsRaw.map(asString).filter(Boolean)
      : [],

    leadership: toLeadership(
      pickFirst(
        root?.founders,
        root?.leadership,
        root?.leadershipTeam,
        company?.leadership,
        company?.team,
      ),
    ),
    advisory: toAdvisory(
      pickFirst(
        root?.advisoryBoards,
        root?.advisory,
        root?.advisoryBoard,
        company?.advisory,
        company?.advisoryBoard,
      ),
    ),

    social: toSocial(root, social),
  };

  const financials: FinancialsForm = {
    ...EMPTY_FINANCIALS,
    fundingStage: asString(
      pickFirst(
        financialsRoot?.fundingStageId,
        financialsRoot?.fundingStage?.name,
        financialsRoot?.fundingStage?.id,
        financialsRoot?.fundingStageR?.name,
        financialsRoot?.fundingStageR?.id,
        financialsRoot?.fundingStageName,
      ),
    ),
    isRaisingFunds: asBoolean(
      pickFirst(root?.isRaisingFunds, financialsRoot?.isRaisingFunds),
      false,
    ),
    targetFundraise: asString(financialsRoot?.targetFundraise),
    tentativeValuation: asString(financialsRoot?.tentativeValuation),
    investmentMechanisms: asIdentifierArray(
      pickFirst(
        financialsRoot?.investmentMechanisms,
        financialsRoot?.investmentMechanismOptions,
      ),
    ),
    totalFundRaised: asString(financialsRoot?.totalFundRaised),
    pastFunding: asString(financialsRoot?.pastFunding),
    revenueStage: asString(financialsRoot?.revenueStage),
    grossRevenues: asString(financialsRoot?.grossRevenues),
    grossRevenuesQ1: asString(financialsRoot?.grossRevenuesQ1),
    grossRevenuesQ2: asString(financialsRoot?.grossRevenuesQ2),
    grossRevenuesQ3: asString(financialsRoot?.grossRevenuesQ3),
    timeToCommercialize: asString(financialsRoot?.timeToCommercialize),
    investmentBankerOpportunity: asString(
      financialsRoot?.investmentBankerOpportunity,
    ),
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

  return {basicInfo, financials, profileCompletion, raw: data};
};

export const buildBasicInfoPayload = (info: BasicInfoForm) => ({
  companyName: info.companyName,
  // When the user marks "Not incorporated", the field is hidden in the UI
  // and `incorporationYear` is cleared. Backend still requires a numeric
  // year, so fall back to the current year in that case — mirrors the web.
  yearOfIncorporation:
    info.isIncorporated === false
      ? String(new Date().getFullYear())
      : info.incorporationYear,
  registeredCountryId: info.countryId,
  registeredStateId: info.stateId,
  registeredCityId: info.cityId,
  companySize: info.companySize,
  displayWebsite: info.social.website,
  // Backend's `isNotRegistered` actually tracks "is incorporated" — Yes → true,
  // No → false. Same misleading name on the server; we mirror exactly what
  // the user picked, not the literal English of the field name.
  isNotRegistered: info.isIncorporated === true,
  servicesLookingFor: info.servicesLookingFor,
  linkedinUrl: info.social.linkedin,
  twitterUrl: info.social.twitter,
  facebookUrl: info.social.facebook,
  instagramUrl: info.social.instagram,
  youtubeUrl: info.social.youtube,
  // Regulatory numbers — send only when the user opted in / company is
  // incorporated. Matches frontend's `payload.gstNumber = gstinVisible ? ... : null` pattern.
  gstNumber: info.gstinVisible ? info.gstNumber || null : null,
  dpiitNumber: info.dpiitVisible ? info.dpiitNumber || null : null,
  cinNumber: info.isIncorporated === true ? info.cinNumber || null : null,
});

export const buildFinancialsPayload = (info: FinancialsForm) => ({
  isRaisingFunds: info.isRaisingFunds,
  financials: {
    fundingStageId: Number(info.fundingStage) || info.fundingStage,
    targetFundraise: info.targetFundraise,
    tentativeValuation: info.tentativeValuation,
    investmentMechanisms: info.investmentMechanisms.map(item =>
      Number(item) || item,
    ),
    totalFundRaised: info.totalFundRaised,
    pastFunding: info.pastFunding,
    revenueStage: info.revenueStage,
    grossRevenues: info.grossRevenues,
    grossRevenuesQ1: info.grossRevenuesQ1,
    grossRevenuesQ2: info.grossRevenuesQ2,
    grossRevenuesQ3: info.grossRevenuesQ3,
    timeToCommercialize: info.timeToCommercialize,
    investmentBankerOpportunity: info.investmentBankerOpportunity,
  },
});
