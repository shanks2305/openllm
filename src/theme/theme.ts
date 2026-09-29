export const colors = {
  background: '#212121',
  sidebar: '#171717',
  surface: '#2A2A2A',
  surfaceElevated: '#303030',
  surfacePressed: '#3A3A3A',
  border: '#3A3A3A',
  borderSubtle: '#2E2E2E',
  text: '#ECECEC',
  textSecondary: '#B4B4B4',
  textMuted: '#8E8E8E',
  accent: '#D97757',
  accentMuted: '#4A2F25',
  onPrimary: '#171717',
  codeBackground: '#171717',
  danger: '#F87171',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const typography = {
  display: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600' as const,
    letterSpacing: -0.4,
    color: colors.text,
  },
  title: {
    fontSize: 22,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
    color: colors.text,
  },
  body: {
    fontSize: 16,
    color: colors.text,
  },
  caption: {
    fontSize: 13,
    color: colors.textSecondary,
  },
};

export const theme = {
  colors,
  spacing,
  radii,
  typography,
  dark: true,
};

export type Theme = typeof theme;
