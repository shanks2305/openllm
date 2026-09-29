export const colors = {
  background: '#0B0B0D',
  surface: '#16161A',
  surfaceElevated: '#1E1E24',
  border: '#2A2A32',
  text: '#F4F4F5',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  accent: '#8B7CFF',
  accentMuted: '#3D3578',
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
  full: 999,
} as const;

export const typography = {
  title: {
    fontSize: 22,
    fontWeight: '600' as const,
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
