import {
  getAuthHeader,
  getErrorMessage,
  requestJson,
  resolveBaseUrl,
  safeJsonParse,
} from '../../../core/api/apiClient';
import type {
  AddCommentResponse,
  AddReplyResponse,
  CommentsResponse,
  CommunityPostsResponse,
  CreatePollPayload,
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
    poll: CreatePollPayload | null = null,
  ): Promise<CreatePostResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<CreatePostResponse>(
      `${BASE}/posts`,
      {
        method: 'POST',
        headers: getAuthHeader(token),
        // The backend expects a flat body: `image` / `url` / `file` are always
        // present (empty when unused), and a poll is spread inline as
        // `question` / `timeLine` / `options` — NOT nested under a `poll` key.
        body: JSON.stringify({
          text,
          image: '',
          url: '',
          file: '',
          images,
          ...(poll
            ? {
                question: poll.question,
                timeLine: poll.timeLine,
                options: poll.options,
              }
            : {}),
        }),
      },
      baseUrl,
    );
  },

  // Delete one of the logged-in user's own wall posts (including any attached
  // poll). The backend authorises by owner, so this only succeeds for posts the
  // caller created. Returns just a status message.
  async deletePost(
    token: string,
    postUuid: string,
  ): Promise<{status_code: number; message: string}> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<{status_code: number; message: string}>(
      `${BASE}/posts/${postUuid}`,
      {method: 'DELETE', headers: getAuthHeader(token)},
      baseUrl,
    );
  },

  // Paginated list of comments on a post. Same `{ data: { items, meta } }`
  // shape as the posts feed.
  async listComments(
    token: string,
    postUuid: string,
    {page = 1}: {page?: number} = {},
  ): Promise<CommentsResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<CommentsResponse>(
      `${BASE}/posts/${postUuid}/comments?page=${page}`,
      {method: 'GET', headers: getAuthHeader(token)},
      baseUrl,
    );
  },

  // Post a comment on a wall post. The backend expects `{ comment }` and
  // returns the created comment under `data`.
  async addComment(
    token: string,
    postUuid: string,
    comment: string,
  ): Promise<AddCommentResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<AddCommentResponse>(
      `${BASE}/posts/${postUuid}/comments`,
      {
        method: 'POST',
        headers: getAuthHeader(token),
        body: JSON.stringify({comment}),
      },
      baseUrl,
    );
  },

  // React to a wall post. `reaction` is the reaction-type slug (like / love /
  // funny / surprise / …); defaults to `like`. The backend toggles the
  // logged-in user's reaction for that type and returns just a status message,
  // so callers update counts optimistically.
  async reactToPost(
    token: string,
    postUuid: string,
    reaction: string = 'like',
  ): Promise<{status_code: number; message: string}> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<{status_code: number; message: string}>(
      `${BASE}/posts/${postUuid}/react/${reaction}`,
      {method: 'POST', headers: getAuthHeader(token)},
      baseUrl,
    );
  },

  // Cast a vote on a poll attached to a wall post. The backend identifies the
  // poll and chosen option by numeric id. Returns just a status message, so
  // callers update vote counts optimistically.
  async voteOnPoll(
    token: string,
    pollId: number,
    optionId: number,
  ): Promise<{status_code: number; message: string}> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<{status_code: number; message: string}>(
      `${BASE}/posts/poll/vote`,
      {
        method: 'POST',
        headers: getAuthHeader(token),
        body: JSON.stringify({pollId, optionId}),
      },
      baseUrl,
    );
  },

  // Reply to a comment on a post. The backend nests replies under the parent
  // comment and, like `addComment`, expects `{ comment }`.
  async replyToComment(
    token: string,
    postUuid: string,
    commentUuid: string,
    comment: string,
  ): Promise<AddReplyResponse> {
    const baseUrl = await resolveBaseUrl();
    return requestJson<AddReplyResponse>(
      `${BASE}/posts/${postUuid}/comments/${commentUuid}/reply`,
      {
        method: 'POST',
        headers: getAuthHeader(token),
        body: JSON.stringify({comment}),
      },
      baseUrl,
    );
  },
};
