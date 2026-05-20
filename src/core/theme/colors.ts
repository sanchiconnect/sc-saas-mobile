// App-wide design tokens. Tenant-supplied colors (primary, secondary, danger,
// success) override these at render time via `TenantContext.theme` — this file
// is the *no-tenant fallback* + the canonical source for all neutral/semantic
// colors. Components should:
//   1. Always prefer `useTenant().theme.<X>` for brand-tied colors.
//   2. Use these `colors.*` tokens for neutrals (background, text, borders).
//   3. Never inline raw hex literals for status / brand colors.

export const colors = {
  // Brand defaults — overridden by `TenantContext.theme.primary` etc.
  primary: '#0f172a',
  secondary: '#cbd5e1',

  // Semantic status colors. Same fallback shape so a tenant can selectively
  // override any of them.
  danger: '#dc2626',
  success: '#15803d',
  warning: '#b45309',
  info: '#1d4ed8',

  // Soft status backgrounds (for banners, badges, pills).
  dangerSoft: '#fef2f2',
  successSoft: '#f0fdf4',
  warningSoft: '#fef3c7',
  infoSoft: '#eff6ff',
  dangerSoftBorder: '#fca5a5',
  successSoftBorder: '#86efac',
  warningSoftBorder: '#fcd34d',
  infoSoftBorder: '#93c5fd',

  // Neutrals — slate scale.
  text: '#0f172a',
  textMuted: '#64748b',
  textSubtle: '#94a3b8',
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceMuted: '#f1f5f9',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  placeholder: '#94a3b8',
  divider: '#e2e8f0',
  scrim: 'rgba(15, 23, 42, 0.45)',
};

// Spacing scale (4px base). Use these instead of inline magic numbers.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// Border radii. Pick the smallest that visually makes sense.
export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  pill: 999,
};

// Typography ramp — RN doesn't have a built-in scale.
export const typography = {
  caption: 11,
  small: 12,
  body: 14,
  bodyLg: 15,
  subhead: 16,
  title: 18,
  titleLg: 22,
  heading: 28,
};

// Standardised shadow presets (iOS-style; Android leans on `elevation`).
export const shadows = {
  none: {},
  sm: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: {width: 0, height: 2},
    elevation: 1,
  },
  md: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 3,
  },
  lg: {
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: {width: 0, height: 8},
    elevation: 6,
  },
};

// Helper: apply alpha to any hex color (#RRGGBB → #RRGGBBAA). For tints like
// "primary at 10% opacity" without juggling rgba strings throughout the code.
// alpha is 0..1.
export const withAlpha = (hex: string, alpha: number): string => {
  if (!hex || hex[0] !== '#') return hex;
  const clamped = Math.min(1, Math.max(0, alpha));
  const a = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0');
  // Already an 8-digit hex — replace its alpha component.
  if (hex.length === 9) {
    return `${hex.slice(0, 7)}${a}`;
  }
  // 4-digit short hex (#RGBA) is uncommon here; ignore.
  if (hex.length !== 7) {
    return hex;
  }
  return `${hex}${a}`;
};
