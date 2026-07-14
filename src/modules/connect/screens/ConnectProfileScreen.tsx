import React from 'react';

import type {Conversation} from '../../chat/types';
import type {ConnectRoleKey, DirectoryUser} from '../types';
import {CorporateProfileScreen} from './detail/CorporateProfileScreen';
import {IndividualProfileScreen} from './detail/IndividualProfileScreen';
import {InvestorProfileScreen} from './detail/InvestorProfileScreen';
import {MentorProfileScreen} from './detail/MentorProfileScreen';
import {PartnerProfileScreen} from './detail/PartnerProfileScreen';
import {ProgramOfficeProfileScreen} from './detail/ProgramOfficeProfileScreen';
import {ServiceProviderProfileScreen} from './detail/ServiceProviderProfileScreen';
import {StartupProfileScreen} from './detail/StartupProfileScreen';

type Props = {
  token: string;
  role: ConnectRoleKey;
  user: DirectoryUser;
  primaryColor: string;
  logoBaseUrl?: string;
  onBack: () => void;
  isApproved?: boolean;
  currentUserId?: string;
  currentUserNumericId?: string;
  currentUserAccountType?: string;
  onEditProfile?: () => void;
  onOpenChat?: (conversation: Conversation) => void;
};

export function ConnectProfileScreen({role, ...rest}: Props) {
  switch (role) {
    case 'investors':
      return <InvestorProfileScreen {...rest} />;
    case 'startups':
      return <StartupProfileScreen {...rest} />;
    case 'mentors':
      return <MentorProfileScreen {...rest} />;
    case 'corporates':
      return <CorporateProfileScreen {...rest} />;
    case 'service-providers':
      return <ServiceProviderProfileScreen {...rest} />;
    case 'partners':
      return <PartnerProfileScreen {...rest} />;
    case 'individuals':
      return <IndividualProfileScreen {...rest} />;
    case 'program-office-team':
      return <ProgramOfficeProfileScreen {...rest} />;
    default:
      // Fallback: render investor layout for unknown roles
      return <InvestorProfileScreen {...rest} />;
  }
}
