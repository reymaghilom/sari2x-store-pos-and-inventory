const light = {
  background: '#F7F9FC',
  surface: '#FFFFFF',
  surfaceSecondary: '#F1F5F9',
  surfaceMuted: '#F1F5F9',
  textPrimary: '#111827',
  text: '#111827',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  primary: '#1D4ED8',
  primaryDark: '#1E40AF',
  primarySoft: '#EEF3FF',
  primaryBorder: '#C7D7FE',
  primaryText: '#FFFFFF',
  success: '#15803D',
  successSoft: '#EAF8EE',
  successBorder: '#BFE3C9',
  warning: '#D97706',
  warningSoft: '#FFF7E6',
  warningBorder: '#F1D49B',
  danger: '#DC2626',
  dangerSoft: '#FEF0F0',
  dangerBorder: '#F4C2C2',
  info: '#0369A1',
  infoSoft: '#EAF6FC',
  infoBorder: '#B9DFF1',
  white: '#FFFFFF',
  black: '#0B0F17',
} as const;

export type ThemeColors = { [Key in keyof typeof light]: string };

const dark: ThemeColors = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceSecondary: '#263449',
  surfaceMuted: '#263449',
  textPrimary: '#F8FAFC',
  text: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  border: '#334155',
  primary: '#60A5FA',
  primaryDark: '#93C5FD',
  primarySoft: '#1E3A5F',
  primaryBorder: '#315A88',
  primaryText: '#0F172A',
  success: '#4ADE80',
  successSoft: '#173A2A',
  successBorder: '#25613D',
  warning: '#FBBF24',
  warningSoft: '#493516',
  warningBorder: '#76551D',
  danger: '#F87171',
  dangerSoft: '#472126',
  dangerBorder: '#7F3038',
  info: '#38BDF8',
  infoSoft: '#173447',
  infoBorder: '#285E78',
  white: '#FFFFFF',
  black: '#0B0F17',
};

export const themeHex: { light: ThemeColors; dark: ThemeColors } = { light, dark };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 36 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;
export const typography = {
  caption: 11, bodySmall: 13, body: 15, subtitle: 17, title: 22, display: 28,
  regular: '400' as const, medium: '500' as const, semibold: '600' as const, bold: '700' as const,
} as const;
export const shadow = { shadowColor: '#0B0F17', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 };
