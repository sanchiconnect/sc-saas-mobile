import {
  getAuthHeader,
  getErrorMessage,
  requestJson,
  resolveBaseUrl,
  safeJsonParse,
} from '../../../core/api/apiClient';
import type {
  CommunityPostsResponse,
  CreatePostResponse,
  WallStatsResponse,
} from '../types';

const BASE = 'api/v1/community-wall';

export const communityService = {
  // Paginated feed of community-wall posts. The backend paginates with a
  // `page` query param and returns `{ data: { items, meta } }`.
  async listPosts(
    token: string,
    {page = 1}: {page?: number} = {},
  ): Promise<CommunityPostsResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<CommunityPostsResponse>(
      `${BASE}/posts?page=${page}`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
  },

  // A particular user's own posts (used for the "My Posts" stat → the
  // logged-in user's uuid). Same paginated shape as the feed.
  async listUserPosts(
    token: string,
    userUuid: string,
    {page = 1}: {page?: number} = {},
  ): Promise<CommunityPostsResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<CommunityPostsResponse>(
      `${BASE}/posts/user/${userUuid}?page=${page}`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
  },

  // Posts the logged-in user has commented on.
  async listMyComments(
    token: string,
    {page = 1}: {page?: number} = {},
  ): Promise<CommunityPostsResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<CommunityPostsResponse>(
      `${BASE}/posts/me/comments?page=${page}`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
  },

  // Posts (with polls) the logged-in user created a poll on.
  async listMyPolls(
    token: string,
    {page = 1}: {page?: number} = {},
  ): Promise<CommunityPostsResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<CommunityPostsResponse>(
      `${BASE}/posts/me/polls?page=${page}`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
  },

  // Posts the logged-in user has reacted to.
  async listMyReactions(
    token: string,
    {page = 1}: {page?: number} = {},
  ): Promise<CommunityPostsResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<CommunityPostsResponse>(
      `${BASE}/posts/me/reactions?page=${page}`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
  },

  // Logged-in user's wall activity counts (posts, comments, polls, reactions),
  // shown in the stats card at the top of the feed.
  async getMyStats(token: string): Promise<WallStatsResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<WallStatsResponse>(
      `${BASE}/posts/me/stats`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
  },

  // Upload a single image for a post. Returns the stored S3-relative path
  // (e.g. `users/.../community-wall/image/x.png`) which is then attached to
  // the post's `images` array on create.
  async uploadFile(
    token: string,
    file: {uri: string; name: string; type: string},
  ): Promise<string> {
    const baseUrl = await resolveBaseUrl();
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);
    // Backend requires a `fileType` enum alongside the file; it routes the
    // upload into the `community-wall/<fileType>/…` folder.
    formData.append('fileType', 'image');

    const response = await fetch(`${baseUrl}${BASE}/posts/upload-file`, {
      method: 'POST',
      headers: {Accept: 'application/json', ...getAuthHeader(token)},
      body: formData as any,
    });
    const raw = await response.text();
    const data = raw ? safeJsonParse(raw) : null;
    if (!response.ok) {
      throw new Error(
        getErrorMessage(data) || `Image upload failed (${response.status}).`,
      );
    }
    return data?.data as string;
  },

  // Create a post on the wall. The editor produces rich-text HTML stored in
  // `text`; `images` holds the paths returned by `uploadFile`.
  async createPost(
    token: string,
    text: string,
    images: string[] = [],
  ): Promise<CreatePostResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<CreatePostResponse>(
      `${BASE}/posts`,
      {
        method: 'POST',
        headers: getAuthHeader(token),
        body: JSON.stringify({text, images}),
      },
      baseUrl,
    );
  },
};
