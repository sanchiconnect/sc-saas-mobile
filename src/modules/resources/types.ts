// Shapes for the dashboard "Resources" section (`api/v1/dashboards/content`).
// A single call returns the News feed, the Report & Download library and
// (when available) Videos. Only the fields the mobile cards render are typed;
// the backend returns more (sentiment, privacy, uri, …) which we ignore.

// A news article — from `data.news.results[]`.
export type ResourceNews = {
  id: number;
  title: string;
  // Article body; a cleaned snippet is shown under the title.
  body?: string;
  // External article link; opened in the browser on tap.
  url: string;
  // Absolute image URL, or null → "No Image" placeholder.
  image: string | null;
  // Human-readable publisher name (e.g. "The Times of India").
  source_title: string;
  // ISO publish timestamp.
  dateTimePub: string;
  category: {id: number; name: string} | null;
};

// Paginated news block wrapping the article list.
export type ResourceNewsBlock = {
  total_records: number;
  total_pages: number;
  page: number;
  limit: number;
  count: number;
  results: ResourceNews[];
};

// A downloadable report — from `data.reportDownloads[]`. The asset is either an
// external URL (`uploadType: 'external_url'`) or an uploaded `file.objectUrl`.
export type ReportDownload = {
  id: number;
  title: string;
  description: string;
  // Relative S3 path (e.g. `industry_reports/thumbnails/x.jpg`) or null.
  thumbNailImage: string | null;
  // Attribution / source label (e.g. "Nasscom").
  courtesy: string;
  uploadType: 'external_url' | 'file' | string;
  externalUrl: string;
  file: {objectUrl: string} | null;
  tags: string;
  industries: string[];
  createdAt: string;
};

// A video resource. NOTE: the sample response was truncated before the videos
// block, so these fields are a best guess and read defensively in the service.
// Confirm against the real payload and tighten as needed.
export type ResourceVideo = {
  id: number;
  title?: string;
  thumbNailImage?: string | null;
  // Either of these may carry the playable/watch URL depending on the backend.
  url?: string | null;
  videoUrl?: string | null;
  createdAt?: string;
};

export type DashboardContent = {
  reportDownloads: ReportDownload[];
  news: ResourceNewsBlock;
  videos?: ResourceVideo[];
};

export type DashboardContentResponse = {
  status_code: number;
  message: string;
  data: DashboardContent;
};
