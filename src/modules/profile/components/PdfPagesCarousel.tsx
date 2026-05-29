import React, {useContext, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {Icon} from '../../../core/components/Icon';
import {TenantContext} from '../../../core/tenant/TenantProvider';

// Loose type so consumers can pass the raw API `pitchDeck` object without
// having to massage the field shape on their end. Each `*Images` field is
// optional because the backend uses different keys across deployments.
export type PitchDeckLike = {
  pitchDocument?: string | null;
  pitchDocumentImages?: unknown;
  pitchImages?: unknown;
  documentImages?: unknown;
  images?: unknown;
  pdfImages?: unknown;
  pages?: unknown;
};

// Pull a single image URL string out of whatever shape the backend ships —
// some endpoints return plain strings, others wrap each page as
// `{url}` / `{path}` / `{src}` / `{image}`. Unrecognized entries are
// dropped.
const imageUrlFromEntry = (entry: unknown): string => {
  if (!entry) return '';
  if (typeof entry === 'string') return entry;
  if (typeof entry === 'object') {
    const obj = entry as Record<string, unknown>;
    const candidate =
      obj.url || obj.path || obj.image || obj.src || obj.filePath || obj.fileName;
    return typeof candidate === 'string' ? candidate : '';
  }
  return '';
};

// Resolve a (possibly relative) server path against the tenant's CDN / API
// origin so external openers (browser, download) always receive an
// absolute URL. Walks the most-specific origin first.
const resolveUrl = (
  path: string,
  bases: Array<string | null | undefined>,
): string => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const base = bases.find(b => typeof b === 'string' && b.length > 0);
  if (!base) return path;
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
};

// Flexible reader for the pre-converted page-image array on `pitchDeck`.
// The exact field name varies between deployments, so we walk a list of
// candidates and return the first non-empty one, resolved to absolute URLs.
export const getPitchImages = (
  pitchDeck: PitchDeckLike | null | undefined,
  bases: Array<string | null | undefined>,
): string[] => {
  if (!pitchDeck) return [];
  const candidates: unknown[] = [
    pitchDeck.pitchDocumentImages,
    pitchDeck.pitchImages,
    pitchDeck.documentImages,
    pitchDeck.images,
    pitchDeck.pdfImages,
    pitchDeck.pages,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      const urls = candidate
        .map(imageUrlFromEntry)
        .filter(Boolean)
        .map(u => resolveUrl(u, bases));
      if (urls.length > 0) return urls;
    }
  }
  return [];
};

// Hook variant — pulls the tenant origins from context for the common case
// where the caller doesn't already have them. Returns [] when pitchDeck
// has no recognizable image array.
export const usePitchImages = (
  pitchDeck: PitchDeckLike | null | undefined,
): string[] => {
  const {baseUrl, globalSetting} = useContext(TenantContext);
  return getPitchImages(pitchDeck, [
    globalSetting?.imgKitUrl,
    globalSetting?.assetsImgKitUrl,
    globalSetting?.s3Url,
    baseUrl,
  ]);
};

type Props = {
  images: string[];
  primaryColor: string;
  // Visual height of the preview frame. Defaults to 360 to match the
  // edit-profile preview; pass a larger value (e.g. 480) for view-only
  // surfaces like the public profile page where the user has more room.
  height?: number;
};

// Image-based pitch-deck carousel — the backend pre-renders each PDF page
// to a JPG on upload, so we flip through those images instead of trying
// to rasterize the PDF on-device. Mirrors the web `<ngb-carousel>`.
export function PdfPagesCarousel({images, primaryColor, height = 360}: Props) {
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const total = images.length;
  const safePage = Math.min(Math.max(1, page), Math.max(1, total));
  const currentUrl = images[safePage - 1];

  // Reset per-image load state whenever the user flips pages.
  const goTo = (next: number) => {
    if (next < 1 || next > total) return;
    setLoaded(false);
    setErrored(false);
    setPage(next);
  };

  if (total === 0) return null;

  const canPrev = safePage > 1;
  const canNext = safePage < total;

  return (
    <View style={[styles.frame, {height}]}>
      <Image
        source={{uri: currentUrl}}
        style={styles.image}
        resizeMode="contain"
        onLoadEnd={() => setLoaded(true)}
        onError={() => {
          setLoaded(true);
          setErrored(true);
        }}
      />

      {!loaded ? (
        <View style={styles.statusOverlay} pointerEvents="none">
          <ActivityIndicator color={primaryColor} />
          <Text style={styles.statusText}>Loading page {safePage}…</Text>
        </View>
      ) : null}

      {errored ? (
        <View style={styles.statusOverlay} pointerEvents="none">
          <Icon name="image-broken-variant" size={36} color={primaryColor} />
          <Text style={styles.statusText}>Couldn't load this page.</Text>
        </View>
      ) : null}

      {/* Floating Prev / Next chevrons match the web carousel pattern. */}
      <Pressable
        onPress={() => goTo(safePage - 1)}
        disabled={!canPrev}
        hitSlop={8}
        style={({pressed}) => [
          styles.pagerBtn,
          styles.pagerBtnLeft,
          !canPrev && styles.pagerBtnDisabled,
          pressed && canPrev && styles.pressed,
        ]}>
        <Icon
          name="chevron-left"
          size={24}
          color={canPrev ? '#0f172a' : '#cbd5e1'}
        />
      </Pressable>
      <Pressable
        onPress={() => goTo(safePage + 1)}
        disabled={!canNext}
        hitSlop={8}
        style={({pressed}) => [
          styles.pagerBtn,
          styles.pagerBtnRight,
          !canNext && styles.pagerBtnDisabled,
          pressed && canNext && styles.pressed,
        ]}>
        <Icon
          name="chevron-right"
          size={24}
          color={canNext ? '#0f172a' : '#cbd5e1'}
        />
      </Pressable>

      <View style={styles.pagerBadge}>
        <Text style={styles.pagerBadgeText}>
          {safePage} / {total}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: 'stretch',
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    backgroundColor: '#f8fafc',
    height: '100%',
    width: '100%',
  },
  statusOverlay: {
    alignItems: 'center',
    bottom: 0,
    gap: 10,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: 24,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  statusText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  pagerBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    elevation: 3,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    shadowColor: '#0f172a',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.18,
    shadowRadius: 6,
    top: '50%',
    transform: [{translateY: -20}],
    width: 40,
  },
  pagerBtnLeft: {
    left: 8,
  },
  pagerBtnRight: {
    right: 8,
  },
  pagerBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.5)',
    elevation: 0,
    shadowOpacity: 0,
  },
  pagerBadge: {
    backgroundColor: 'rgba(15,23,42,0.78)',
    borderRadius: 999,
    bottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    position: 'absolute',
    right: 10,
  },
  pagerBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});
