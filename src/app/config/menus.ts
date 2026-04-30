import type {MenuItem} from '../types';

export const connectItems: MenuItem[] = [
  {key: 'startups', label: 'Startups', icon: 'rocket-launch'},
  {key: 'investors', label: 'Investors', icon: 'cash-multiple'},
  {key: 'corporates', label: 'Corporates', icon: 'office-building'},
  {key: 'mentors', label: 'Mentors', icon: 'account-tie'},
  {key: 'service-providers', label: 'Service Providers', icon: 'briefcase'},
  {key: 'partners', label: 'Partners', icon: 'handshake'},
  {key: 'program-office-team', label: 'Program Office Team', icon: 'account-group'},
  {key: 'individuals', label: 'Individuals', icon: 'account'},
];

export const programItems: MenuItem[] = [
  {key: 'all-programs', label: 'All Programs', icon: 'view-grid'},
  {key: 'my-applications', label: 'My Applications', icon: 'file-document'},
  {key: 'certificates', label: 'Certificates', icon: 'certificate'},
  {key: 'events', label: 'Events', icon: 'calendar'},
];

export const editorTools: MenuItem[] = [
  {key: 'bold', label: 'Bold', icon: 'format-bold'},
  {key: 'italic', label: 'Italic', icon: 'format-italic'},
  {key: 'underline', label: 'Underline', icon: 'format-underline'},
  {key: 'link', label: 'Link', icon: 'link'},
];
