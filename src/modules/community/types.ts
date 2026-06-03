// Shapes for the Community Wall feed (`api/v1/community-wall/posts`).
// Only the fields the mobile feed renders are typed; the backend returns
// more (e.g. per-reaction breakdowns) which we keep loosely typed.

export type CommunityPostUser = {
  uuid: string;
  name: string;
  // Relative S3 path (e.g. `users/abc/avatar/x.png`) or absolute URL.
  avatar?: string | null;
  organizationType?: string | null;
  organizationUUID?: string | null;
  organizationName?: string | null;
  organizationLogo?: string | null;
};

export type CommunityReactionCount = {
  like: number;
  dislike: number;
  support: number;
  love: number;
  funny: number;
  surprise: number;
  laugh: number;
};

export type CommunityPostStats = {
  totalComments: number;
  totalReactions: number;
  reactionCount: CommunityReactionCount;
};

export type CommunityPollVote = {
  userId: number;
  userName: string;
};

export type CommunityPollOption = {
  id: number;
  optionText: string;
  voteCount: number;
  userVoted: boolean;
  votes: CommunityPollVote[];
};

export type CommunityPoll = {
  id: number;
  question: string;
  // Backend enum: 'one_day' | 'one_week' | 'one_month' | ... — drives the
  // "time left" label.
  timeLine: string;
  pollCreatedAt: string;
  totalVotes: number;
  options: CommunityPollOption[];
};

export type CommunityPost = {
  uuid: string;
  createdAt: string;
  modifiedAt: string;
  // Rich-text HTML string. The feed strips tags for a plain-text preview.
  text: string;
  image?: string | null;
  images: string[];
  url?: string | null;
  file?: string | null;
  isAdminPost: boolean;
  pinned: boolean;
  user: CommunityPostUser;
  stats: CommunityPostStats;
  isLoggedInUserReacted: boolean;
  poll: CommunityPoll | null;
};

// Per-user wall activity counts (`api/v1/community-wall/posts/me/stats`).
export type WallStats = {
  totalPost: number;
  totalComment: number;
  totalReplyComment: number;
  totalPostReaction: number;
  totalCommentReaction: number;
  totalPoll: number;
};

export type WallStatsResponse = {
  status_code: number;
  message: string;
  data: WallStats;
};

export type CreatePostResponse = {
  status_code: number;
  message: string;
  data?: CommunityPost;
};

export type PaginationMeta = {
  totalItems: number;
  itemCount: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
};

export type CommunityPostsResponse = {
  status_code: number;
  message: string;
  data: {
    items: CommunityPost[];
    meta: PaginationMeta;
  };
};
