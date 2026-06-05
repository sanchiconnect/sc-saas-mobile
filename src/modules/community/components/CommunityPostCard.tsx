import React, {useContext, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {Tooltip} from '../../../core/components/Tooltip';
import {TenantContext} from '../../../core/tenant/TenantProvider';
import {radii, spacing, typography, withAlpha} from '../../../core/theme/colors';
import {APPROVAL_REQUIRED_MESSAGE} from '../constants';
import {communityService} from '../services/community.service';
import {EditPostModal} from './EditPostModal';
import {SharePostModal} from './SharePostModal';
import type {CommunityComment, CommunityPost} from '../types';

// Greyed-out tint for footer actions in readOnly (guest) mode.
const MUTED = '#cbd5e1';

type Props = {
  post: CommunityPost;
  // Auth token — required to post a comment.
  token: string;
  // Tenant imgKit base for resolving relative avatar / image paths.
  logoBaseUrl?: string;
  // Guest / shared-post mode: render the post but disable every write action
  // (comment, reply, react, share). Used by the share preview so a signed-out
  // viewer can read the post without being able to interact with it.
  readOnly?: boolean;
  // Whether the signed-in user is approved to interact (comment, react, share).
  // Unapproved users see the actions muted with an "admin approval" tooltip.
  // Defaults to true so existing call sites are unaffected.
  canInteract?: boolean;
  // Called after a reaction is successfully toggled, so the parent can refresh
  // wall stats (e.g. the "reactions" tally in the stats card).
  onReacted?: () => void;
  // Logged-in user's uuid. When it matches the post author, the header shows a
  // "..." menu with Edit / Delete. Omitted (guest / share preview) → no menu.
  currentUserUuid?: string;
  // Called with the post uuid after the user deletes their own post, so the
  // parent can drop it from the feed and refresh wall stats.
  onDeleted?: (uuid: string) => void;
};

// Resolve a relative S3 path (`users/abc/x.png`) into an absolute URL using
// the tenant's imgKit base. Absolute URLs are returned untouched.
const resolveUrl = (raw?: string | null, baseUrl?: string): string | null => {
  if (!raw) return null;
  if (/^https?:\/\//.test(raw)) return raw;
  if (!baseUrl) return null;
  return `${baseUrl.replace(/\/$/, '')}/${raw.replace(/^\//, '')}`;
};

// The feed shows a plain-text preview. Strip HTML tags and decode the few
// entities that show up most often in the editor output.
const stripHtml = (html?: string): string => {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// Short "x ago" relative time. Falls back to the raw value if unparseable.
const timeAgo = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return `${secs} second${secs === 1 ? '' : 's'} ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
};

// Map the poll's `timeLine` enum to a duration (ms), then describe how much
// time is left relative to when the poll was created.
const POLL_DURATION_MS: Record<string, number> = {
  one_day: 24 * 60 * 60 * 1000,
  one_week: 7 * 24 * 60 * 60 * 1000,
  one_month: 30 * 24 * 60 * 60 * 1000,
};

const pollTimeLeft = (timeLine: string, createdAt: string): string => {
  const duration = POLL_DURATION_MS[timeLine];
  const start = new Date(createdAt).getTime();
  if (!duration || Number.isNaN(start)) return '';
  const remaining = start + duration - Date.now();
  if (remaining <= 0) return 'Poll ended';
  const day = 24 * 60 * 60 * 1000;
  if (remaining < day) return 'Less than a day left';
  const days = Math.floor(remaining / day);
  return `${days} day${days === 1 ? '' : 's'} left`;
};

export function CommunityPostCard({
  post,
  token,
  logoBaseUrl,
  readOnly = false,
  canInteract = true,
  onReacted,
  currentUserUuid,
  onDeleted,
}: Props) {
  const {domain, theme} = useContext(TenantContext);
  // Brand accent for the "reacted" (liked) state; falls back to a blue.
  const reactedColor = theme?.primary || '#2563eb';
  // Approval gate: a signed-in but unapproved user. Distinct from `readOnly`
  // (signed-out guest) so we can show an "admin approval" tooltip instead of a
  // "sign in" hint. Both states block every write action.
  const locked = !readOnly && !canInteract;
  // Web URL to this post for the share sheet. Must mirror the frontend's
  // single-post route (`/community-feed/posts/post/:uuid`); only built when
  // the tenant domain is known.
  const shareUrl = domain
    ? `https://${domain}/community-feed/posts/post/${post.uuid}`
    : undefined;
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  // Locally tracked so the footer count bumps right after a successful post,
  // without waiting for a full feed reload.
  const [commentCount, setCommentCount] = useState(post.stats.totalComments);
  // Reaction state — seeded from the feed and updated optimistically so the
  // thumb fills and the count bumps the instant the user taps.
  const [reacted, setReacted] = useState(post.isLoggedInUserReacted);
  const [reactionCount, setReactionCount] = useState(post.stats.totalReactions);
  const [isReacting, setIsReacting] = useState(false);
  // Poll state — seeded from the feed and updated optimistically on vote.
  const [pollOptions, setPollOptions] = useState(post.poll?.options ?? []);
  const [pollTotalVotes, setPollTotalVotes] = useState(
    post.poll?.totalVotes ?? 0,
  );
  const [isVoting, setIsVoting] = useState(false);
  // Comment thread — lazily fetched the first time the user expands it.
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  // Reply composer — only one comment's reply box is open at a time.
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyingPosting, setReplyingPosting] = useState(false);
  // Owner overflow menu (Edit / Delete) — open state + in-flight delete guard.
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Edit modal (text-only) open state, plus the post's current rich-text body.
  // Seeded from the feed and updated locally after a successful edit so the
  // card reflects the new text without a full reload.
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [postHtml, setPostHtml] = useState(post.text);
  // Screen-space anchor for the menu, measured from the "..." trigger so the
  // dropdown opens right under it instead of floating at a fixed position.
  const menuBtnRef = useRef<View>(null);
  const [menuAnchor, setMenuAnchor] = useState({top: 0, right: spacing.lg});

  const loadComments = async () => {
    setLoadingComments(true);
    try {
      const res = await communityService.listComments(token, post.uuid);
      const items = res?.data?.items ?? [];
      setComments(items);
      setCommentsLoaded(true);
      // Trust the server's total over the feed snapshot.
      const total = res?.data?.meta?.totalItems;
      if (typeof total === 'number') setCommentCount(total);
    } catch {
      // Leave the thread empty; the user can collapse and retry.
    } finally {
      setLoadingComments(false);
    }
  };

  const toggleComments = () => {
    if (readOnly || locked) return;
    const next = !expanded;
    setExpanded(next);
    if (next && !commentsLoaded && !loadingComments) loadComments();
  };

  const submitComment = async () => {
    const trimmed = comment.trim();
    if (readOnly || locked || !trimmed || isPosting) return;
    setIsPosting(true);
    try {
      const res = await communityService.addComment(token, post.uuid, trimmed);
      setComment('');
      setCommentCount(prev => prev + 1);
      // Show the new comment immediately if the thread is open.
      if (res?.data) setComments(prev => [res.data as CommunityComment, ...prev]);
      if (!expanded) {
        setExpanded(true);
        if (!commentsLoaded) loadComments();
      }
    } catch {
      // Keep the draft so the user can retry on failure.
    } finally {
      setIsPosting(false);
    }
  };

  // Like / unlike the post. The backend toggles the user's `like` reaction for
  // this post, so we flip local state optimistically and roll back on failure.
  const toggleReaction = async () => {
    if (readOnly || locked || isReacting) return;
    const next = !reacted;
    setReacted(next);
    setReactionCount(prev => Math.max(0, prev + (next ? 1 : -1)));
    setIsReacting(true);
    try {
      await communityService.reactToPost(token, post.uuid, 'like');
      // Let the parent refresh wall stats (the reactions tally).
      onReacted?.();
    } catch {
      // Revert the optimistic update if the request failed.
      setReacted(!next);
      setReactionCount(prev => Math.max(0, prev + (next ? -1 : 1)));
    } finally {
      setIsReacting(false);
    }
  };

  // Vote for a poll option. One vote per poll — once cast, the options lock,
  // so this only ever handles a first-time vote. Optimistic, rolls back on
  // failure (which re-enables voting).
  const votePoll = async (optionId: number) => {
    const poll = post.poll;
    if (readOnly || locked || isVoting || !poll) return;
    // Guard against a double-tap landing before the first vote re-renders.
    if (pollOptions.some(o => o.userVoted)) return;

    const prevOptions = pollOptions;
    const prevTotal = pollTotalVotes;

    setPollOptions(prev =>
      prev.map(o =>
        o.id === optionId
          ? {...o, userVoted: true, voteCount: o.voteCount + 1}
          : o,
      ),
    );
    setPollTotalVotes(t => t + 1);

    setIsVoting(true);
    try {
      await communityService.voteOnPoll(token, poll.id, optionId);
    } catch {
      setPollOptions(prevOptions);
      setPollTotalVotes(prevTotal);
    } finally {
      setIsVoting(false);
    }
  };

  const toggleReply = (commentUuid: string) => {
    if (readOnly || locked) return;
    setReplyingTo(prev => (prev === commentUuid ? null : commentUuid));
    setReplyText('');
  };

  const submitReply = async (commentUuid: string) => {
    const trimmed = replyText.trim();
    if (readOnly || locked || !trimmed || replyingPosting) return;
    setReplyingPosting(true);
    try {
      await communityService.replyToComment(
        token,
        post.uuid,
        commentUuid,
        trimmed,
      );
      // Bump the parent comment's reply tally and close the composer.
      setComments(prev =>
        prev.map(c =>
          c.uuid === commentUuid
            ? {...c, totalReplies: (c.totalReplies ?? 0) + 1}
            : c,
        ),
      );
      setReplyText('');
      setReplyingTo(null);
    } catch {
      // Keep the draft so the user can retry on failure.
    } finally {
      setReplyingPosting(false);
    }
  };

  // Measure the trigger in screen space, then open the menu anchored just below
  // its bottom-right corner. Falls back to a top-right default if measuring
  // hasn't resolved yet.
  const openMenu = () => {
    const node = menuBtnRef.current;
    if (!node) {
      setMenuOpen(true);
      return;
    }
    node.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get('window').width;
      setMenuAnchor({
        top: y + height + spacing.xs,
        right: Math.max(spacing.sm, screenWidth - (x + width)),
      });
      setMenuOpen(true);
    });
  };

  // Permanently delete the post. Confirmed via a native alert; on success the
  // parent drops it from the feed. Errors surface in an alert so the card stays.
  const deletePost = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await communityService.deletePost(token, post.uuid);
      onDeleted?.(post.uuid);
    } catch (e: any) {
      Alert.alert('Delete failed', e?.message || 'Could not delete this post.');
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = () => {
    setMenuOpen(false);
    Alert.alert(
      'Delete post',
      'This post will be permanently removed. This cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Delete', style: 'destructive', onPress: deletePost},
      ],
    );
  };

  // Open the text-only edit modal for the author's own post.
  const handleEdit = () => {
    setMenuOpen(false);
    setIsEditOpen(true);
  };

  const avatarUri = resolveUrl(
    post.user.avatar || post.user.organizationLogo,
    logoBaseUrl,
  );
  const orgName = post.user.organizationName;
  const text = stripHtml(postHtml);
  // Prefer the `images` array; fall back to the legacy single `image` field.
  const imagePaths = post.images?.length
    ? post.images
    : post.image
      ? [post.image]
      : [];
  const imageUris = imagePaths
    .map(p => resolveUrl(p, logoBaseUrl))
    .filter((u): u is string => Boolean(u));

  // Poll voting is allowed only for live, approved viewers, while the poll is
  // still open, and only until the user has cast a vote — once voted, the
  // options lock (no switching / re-voting).
  const poll = post.poll;
  const pollTimeLeftLabel = poll
    ? pollTimeLeft(poll.timeLine, poll.pollCreatedAt)
    : '';
  const pollEnded = pollTimeLeftLabel === 'Poll ended';
  const hasVoted = pollOptions.some(o => o.userVoted);
  const canVotePoll = !readOnly && !locked && !pollEnded && !hasVoted;

  // The overflow menu (Edit / Delete) is for the author's own posts only, and
  // never in the read-only share preview.
  const canManage =
    !readOnly && !!currentUserUuid && post.user.uuid === currentUserUuid;

  return (
    <View style={styles.card}>
      {/* Header — avatar, name (org), relative time, overflow menu */}
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          {avatarUri ? (
            <Image
              source={{uri: avatarUri}}
              style={styles.avatarImage}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.avatarText}>
              {post.user.name.slice(0, 2).toUpperCase()}
            </Text>
          )}
          <View style={styles.onlineDot} />
        </View>

        <View style={styles.headerCopy}>
          <Text style={styles.authorName} numberOfLines={1}>
            {post.user.name}
            {orgName ? (
              <Text style={styles.authorOrg}>{`  (${orgName})`}</Text>
            ) : null}
          </Text>
          <Text style={styles.timeText}>{timeAgo(post.createdAt)}</Text>
        </View>

        {canManage ? (
          isDeleting ? (
            <ActivityIndicator size="small" color="#94a3b8" />
          ) : (
            <Pressable
              ref={menuBtnRef}
              onPress={openMenu}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Post options">
              <Icon name="dots-horizontal" size={22} color="#94a3b8" />
            </Pressable>
          )
        ) : null}
      </View>

      {/* Owner overflow menu — Edit / Delete. A transparent backdrop dismisses
          it; the card itself anchors the dropdown to the top-right. */}
      {canManage ? (
        <Modal
          visible={menuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuOpen(false)}>
          <Pressable
            style={styles.menuBackdrop}
            onPress={() => setMenuOpen(false)}>
            <View
              style={[
                styles.menuCard,
                {top: menuAnchor.top, right: menuAnchor.right},
              ]}>
              <Pressable
                style={({pressed}) => [
                  styles.menuItem,
                  pressed && styles.menuItemPressed,
                ]}
                onPress={handleEdit}>
                <Text style={styles.menuItemText}>Edit</Text>
                <Icon name="pencil-outline" size={18} color="#475569" />
              </Pressable>
              <View style={styles.menuDivider} />
              <Pressable
                style={({pressed}) => [
                  styles.menuItem,
                  pressed && styles.menuItemPressed,
                ]}
                onPress={confirmDelete}>
                <Text style={[styles.menuItemText, styles.menuItemDanger]}>
                  Delete
                </Text>
                <Icon name="trash-can-outline" size={18} color="#dc2626" />
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      ) : null}

      {/* Body text */}
      {text ? <Text style={styles.bodyText}>{text}</Text> : null}

      {/* Attached image(s) */}
      {imageUris.map(uri => (
        <View key={uri} style={styles.imageCard}>
          <Image
            source={{uri}}
            style={styles.postImage}
            resizeMode="contain"
          />
        </View>
      ))}

      {/* Poll */}
      {poll ? (
        <View style={styles.pollCard}>
          <Text style={styles.pollQuestion}>{poll.question}</Text>
          {pollOptions.map(option => {
            const voted = option.userVoted;
            // Show results (fill bar + %) once the poll has any votes.
            const showResults = pollTotalVotes > 0;
            const pct = showResults
              ? Math.round((option.voteCount / pollTotalVotes) * 100)
              : 0;
            const inner = (
              <>
                {showResults ? (
                  <View
                    style={[
                      styles.pollOptionFill,
                      {width: `${pct}%`},
                      voted && {backgroundColor: withAlpha(reactedColor, 0.12)},
                    ]}
                  />
                ) : null}
                <View style={styles.pollOptionLabelRow}>
                  <Text
                    style={[
                      styles.pollOptionText,
                      voted && styles.pollOptionTextVoted,
                      voted && {color: reactedColor},
                    ]}
                    numberOfLines={2}>
                    {option.optionText}
                  </Text>
                  {voted ? (
                    <Icon name="check-circle" size={18} color={reactedColor} />
                  ) : null}
                </View>
                {showResults ? (
                  <Text
                    style={[styles.pollOptionPct, voted && {color: reactedColor}]}>
                    {pct}%
                  </Text>
                ) : null}
              </>
            );
            return canVotePoll ? (
              <Pressable
                key={option.id}
                // No pressed-opacity feedback here: the vote already gives
                // immediate visual feedback (fill + check), and dimming on
                // press reads as a distracting "blink" when switching options.
                style={[styles.pollOption, voted && {borderColor: reactedColor}]}
                onPress={() => votePoll(option.id)}
                disabled={isVoting}
                accessibilityRole="button"
                accessibilityState={{selected: voted}}
                accessibilityLabel={`Vote for ${option.optionText}`}>
                {inner}
              </Pressable>
            ) : (
              <View
                key={option.id}
                style={[
                  styles.pollOption,
                  voted && {borderColor: reactedColor},
                ]}>
                {inner}
              </View>
            );
          })}
          <Text style={styles.pollMeta}>
            {pollTotalVotes} vote{pollTotalVotes === 1 ? '' : 's'}
            {' • '}
            {pollTimeLeftLabel}
          </Text>
        </View>
      ) : null}

      {/* Footer — comment / reaction counts + share. In readOnly (guest /
          shared-post) mode every item is rendered muted and non-interactive. */}
      <View style={styles.footer}>
        {locked ? (
          <Tooltip message={APPROVAL_REQUIRED_MESSAGE} accessibilityLabel="Comment">
            <View style={styles.footerItem}>
              <Icon name="comment-outline" size={18} color={MUTED} />
              <Text style={[styles.footerText, styles.footerTextMuted]}>
                {commentCount} comment
                {commentCount === 1 ? '' : 's'}
              </Text>
            </View>
          </Tooltip>
        ) : readOnly ? (
          <View style={styles.footerItem}>
            <Icon name="comment-outline" size={18} color={MUTED} />
            <Text style={[styles.footerText, styles.footerTextMuted]}>
              {commentCount} comment
              {commentCount === 1 ? '' : 's'}
            </Text>
          </View>
        ) : (
          <Pressable
            style={({pressed}) => [
              styles.footerItem,
              pressed && styles.sendPressed,
            ]}
            onPress={toggleComments}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Hide comments' : 'Show comments'}>
            <Icon name="comment-outline" size={18} color="#64748b" />
            <Text style={styles.footerText}>
              {commentCount} comment
              {commentCount === 1 ? '' : 's'}
            </Text>
          </Pressable>
        )}
        {locked ? (
          <Tooltip message={APPROVAL_REQUIRED_MESSAGE} accessibilityLabel="React">
            <View style={styles.footerItem}>
              <Icon name="thumb-up-outline" size={18} color={MUTED} />
              <Text style={[styles.footerText, styles.footerTextMuted]}>
                {reactionCount} reaction
                {reactionCount === 1 ? '' : 's'}
              </Text>
            </View>
          </Tooltip>
        ) : readOnly ? (
          <View style={styles.footerItem}>
            <Icon name="thumb-up-outline" size={18} color={MUTED} />
            <Text style={[styles.footerText, styles.footerTextMuted]}>
              {reactionCount} reaction
              {reactionCount === 1 ? '' : 's'}
            </Text>
          </View>
        ) : (
          <Pressable
            style={({pressed}) => [
              styles.footerItem,
              pressed && styles.sendPressed,
            ]}
            onPress={toggleReaction}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{selected: reacted}}
            accessibilityLabel={reacted ? 'Remove reaction' : 'Like post'}>
            <Icon
              name={reacted ? 'thumb-up' : 'thumb-up-outline'}
              size={18}
              color={reacted ? reactedColor : '#64748b'}
            />
            <Text
              style={[styles.footerText, reacted && {color: reactedColor}]}>
              {reactionCount} reaction
              {reactionCount === 1 ? '' : 's'}
            </Text>
          </Pressable>
        )}
        {locked ? (
          <Tooltip message={APPROVAL_REQUIRED_MESSAGE} accessibilityLabel="Share">
            <View style={styles.footerItem}>
              <Icon name="share-variant-outline" size={18} color={MUTED} />
              <Text style={[styles.footerText, styles.footerTextMuted]}>Share</Text>
            </View>
          </Tooltip>
        ) : readOnly ? (
          <View style={styles.footerItem}>
            <Icon name="share-variant-outline" size={18} color={MUTED} />
            <Text style={[styles.footerText, styles.footerTextMuted]}>Share</Text>
          </View>
        ) : (
          <Pressable
            style={({pressed}) => [
              styles.footerItem,
              pressed && styles.sendPressed,
            ]}
            onPress={() => setIsShareOpen(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Share post">
            <Icon name="share-variant-outline" size={18} color="#64748b" />
            <Text style={styles.footerText}>Share</Text>
          </Pressable>
        )}
      </View>

      {/* Comment thread (lazy — only once expanded) */}
      {expanded ? (
        <View style={styles.thread}>
          <View style={styles.threadHeader}>
            <Text style={styles.threadHeaderText}>Comments</Text>
          </View>
          {loadingComments ? (
            <ActivityIndicator
              size="small"
              color="#64748b"
              style={styles.threadLoader}
            />
          ) : comments.length === 0 ? (
            <Text style={styles.threadEmpty}>No comments yet.</Text>
          ) : (
            comments.map(c => {
              const cAvatar = resolveUrl(c.user?.avatar, logoBaseUrl);
              return (
                <View key={c.uuid} style={styles.commentRow}>
                  <View style={styles.commentAvatar}>
                    {cAvatar ? (
                      <Image
                        source={{uri: cAvatar}}
                        style={styles.avatarImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text style={styles.commentAvatarText}>
                        {(c.user?.name ?? '?').slice(0, 2).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={styles.commentBody}>
                    <View style={styles.commentMetaRow}>
                      <Text style={styles.commentAuthor} numberOfLines={1}>
                        {c.user?.name ?? 'Member'}
                      </Text>
                      <Text style={styles.commentTime}>
                        {timeAgo(c.createdAt)}
                      </Text>
                    </View>
                    <Text style={styles.commentText}>{c.comment}</Text>

                    {/* Reply count + toggle */}
                    <View style={styles.commentActions}>
                      <View style={styles.footerItem}>
                        <Icon
                          name="comment-outline"
                          size={15}
                          color="#94a3b8"
                        />
                        <Text style={styles.commentActionText}>
                          {c.totalReplies ?? 0} repl
                          {(c.totalReplies ?? 0) === 1 ? 'y' : 'ies'}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => toggleReply(c.uuid)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Reply to comment"
                        style={({pressed}) => pressed && styles.sendPressed}>
                        <Text style={styles.replyToggleText}>Reply</Text>
                      </Pressable>
                    </View>

                    {/* Reply composer (only for the active comment) */}
                    {replyingTo === c.uuid ? (
                      <View style={styles.replyBar}>
                        <TextInput
                          style={styles.replyInput}
                          value={replyText}
                          onChangeText={setReplyText}
                          placeholder="Write a reply"
                          placeholderTextColor="#94a3b8"
                          multiline
                          editable={!replyingPosting}
                          onSubmitEditing={() => submitReply(c.uuid)}
                          returnKeyType="send"
                          autoFocus
                        />
                        {replyingPosting ? (
                          <ActivityIndicator size="small" color="#64748b" />
                        ) : (
                          <Pressable
                            onPress={() => submitReply(c.uuid)}
                            disabled={!replyText.trim()}
                            hitSlop={10}
                            accessibilityRole="button"
                            accessibilityLabel="Post reply"
                            style={({pressed}) =>
                              pressed && styles.sendPressed
                            }>
                            <Icon
                              name="send-outline"
                              size={20}
                              color={replyText.trim() ? '#475569' : '#cbd5e1'}
                            />
                          </Pressable>
                        )}
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>
      ) : null}

      {/* Comment composer — disabled in readOnly mode so a signed-out viewer
          sees, but cannot use, the input. */}
      <View
        style={[
          styles.commentBar,
          (readOnly || locked) && styles.commentBarMuted,
        ]}>
        <TextInput
          style={styles.commentInput}
          value={comment}
          onChangeText={setComment}
          placeholder={
            locked
              ? APPROVAL_REQUIRED_MESSAGE
              : readOnly
                ? 'Sign in to comment'
                : 'Write a comment'
          }
          placeholderTextColor="#94a3b8"
          multiline
          editable={!readOnly && !locked && !isPosting}
          onSubmitEditing={submitComment}
          returnKeyType="send"
        />
        {readOnly || locked ? (
          <Icon name="send-outline" size={22} color="#cbd5e1" />
        ) : isPosting ? (
          <ActivityIndicator size="small" color="#64748b" />
        ) : (
          <Pressable
            onPress={submitComment}
            disabled={!comment.trim()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Post comment"
            style={({pressed}) => pressed && styles.sendPressed}>
            <Icon
              name="send-outline"
              size={22}
              color={comment.trim() ? '#475569' : '#cbd5e1'}
            />
          </Pressable>
        )}
      </View>

      {/* Edit modal (text-only) — author's own posts only. */}
      {canManage ? (
        <EditPostModal
          visible={isEditOpen}
          token={token}
          primaryColor={reactedColor}
          postUuid={post.uuid}
          initialHtml={postHtml}
          images={imagePaths}
          onClose={() => setIsEditOpen(false)}
          onSaved={html => {
            setPostHtml(html);
            setIsEditOpen(false);
          }}
        />
      ) : null}

      {/* Share sheet (live mode only) */}
      {readOnly ? null : (
        <SharePostModal
          visible={isShareOpen}
          post={post}
          shareUrl={shareUrl}
          logoBaseUrl={logoBaseUrl}
          onClose={() => setIsShareOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: radii.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  // Backdrop fills the screen; the menu card is pinned near the top-right to
  // sit roughly under the "..." trigger.
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.15)',
  },
  menuCard: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderRadius: radii.md,
    paddingVertical: spacing.xs,
    minWidth: 168,
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  menuItem: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  menuItemPressed: {
    backgroundColor: '#f1f5f9',
  },
  menuItemText: {
    color: '#0f172a',
    fontSize: typography.body,
    fontWeight: '600',
  },
  menuItemDanger: {
    color: '#dc2626',
  },
  menuDivider: {
    backgroundColor: '#e2e8f0',
    height: 1,
    marginHorizontal: spacing.md,
  },
  avatarWrap: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    borderRadius: radii.md,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    position: 'relative',
    width: 52,
  },
  avatarImage: {
    borderRadius: radii.md,
    height: '100%',
    width: '100%',
  },
  avatarText: {
    color: '#475569',
    fontSize: typography.subhead,
    fontWeight: '800',
  },
  onlineDot: {
    backgroundColor: '#16a34a',
    borderColor: '#ffffff',
    borderRadius: 999,
    borderWidth: 2,
    height: 12,
    position: 'absolute',
    right: -3,
    top: -3,
    width: 12,
  },
  headerCopy: {
    flex: 1,
  },
  authorName: {
    color: '#0f172a',
    fontSize: typography.subhead,
    fontWeight: '800',
  },
  authorOrg: {
    color: '#64748b',
    fontSize: typography.body,
    fontWeight: '600',
  },
  timeText: {
    color: '#94a3b8',
    fontSize: typography.small,
    marginTop: 2,
  },
  bodyText: {
    color: '#0f172a',
    fontSize: typography.bodyLg,
    lineHeight: 22,
    marginTop: spacing.md,
  },
  imageCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    overflow: 'hidden',
    padding: spacing.sm,
  },
  postImage: {
    aspectRatio: 1,
    borderRadius: radii.md,
    width: '100%',
  },
  pollCard: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: radii.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  pollQuestion: {
    color: '#0f172a',
    fontSize: typography.subhead,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  pollOption: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  // Result bar — sits behind the option content, width set to the vote %.
  pollOptionFill: {
    backgroundColor: '#eef2f7',
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  pollOptionLabelRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pollOptionText: {
    color: '#0f172a',
    flexShrink: 1,
    fontSize: typography.bodyLg,
  },
  pollOptionTextVoted: {
    fontWeight: '700',
  },
  pollOptionPct: {
    color: '#64748b',
    fontSize: typography.body,
    fontWeight: '700',
    marginLeft: spacing.md,
  },
  pollMeta: {
    color: '#64748b',
    fontSize: typography.small,
    marginTop: spacing.xs,
  },
  footer: {
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
  },
  footerItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  footerText: {
    color: '#64748b',
    fontSize: typography.body,
    fontWeight: '600',
  },
  footerTextMuted: {
    color: MUTED,
  },
  commentBar: {
    alignItems: 'center',
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  commentBarMuted: {
    opacity: 0.7,
  },
  commentInput: {
    color: '#0f172a',
    flex: 1,
    fontSize: typography.bodyLg,
    maxHeight: 96,
    paddingVertical: 0,
  },
  sendPressed: {
    opacity: 0.5,
  },
  thread: {
    marginTop: spacing.md,
  },
  threadHeader: {
    backgroundColor: '#f8fafc',
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  threadHeaderText: {
    color: '#475569',
    fontSize: typography.subhead,
    fontWeight: '700',
  },
  threadLoader: {
    marginVertical: spacing.lg,
  },
  threadEmpty: {
    color: '#94a3b8',
    fontSize: typography.body,
    paddingVertical: spacing.lg,
  },
  commentRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  commentAvatar: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    borderRadius: radii.md,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 40,
  },
  commentAvatarText: {
    color: '#475569',
    fontSize: typography.body,
    fontWeight: '800',
  },
  commentBody: {
    flex: 1,
  },
  commentMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  commentAuthor: {
    color: '#0f172a',
    flexShrink: 1,
    fontSize: typography.body,
    fontWeight: '800',
  },
  commentTime: {
    color: '#94a3b8',
    fontSize: typography.small,
  },
  commentText: {
    color: '#0f172a',
    fontSize: typography.bodyLg,
    lineHeight: 20,
    marginTop: 2,
  },
  commentActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  commentActionText: {
    color: '#94a3b8',
    fontSize: typography.small,
    fontWeight: '600',
  },
  replyToggleText: {
    color: '#475569',
    fontSize: typography.small,
    fontWeight: '700',
  },
  replyBar: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  replyInput: {
    color: '#0f172a',
    flex: 1,
    fontSize: typography.body,
    maxHeight: 80,
    paddingVertical: 0,
  },
});
