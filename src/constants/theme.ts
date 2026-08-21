export const colors = {
  primary: '#2146D0', primaryDark: '#1737AF', primarySoft: '#EEF3FF',
  background: '#F7F9FC', surface: '#FFFFFF', surfaceMuted: '#F1F4F8',
  text: '#111827', textMuted: '#64748B', border: '#E2E8F0',
  success: '#15803D', successSoft: '#EAF8EE', danger: '#DC2626', dangerSoft: '#FEF0F0',
  warning: '#D97706', warningSoft: '#FFF7E6', info: '#0284C7', white: '#FFFFFF',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 36 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;
export const typography = {
  caption: 11, bodySmall: 13, body: 15, subtitle: 17, title: 22, display: 28,
  regular: '400' as const, medium: '500' as const, semibold: '600' as const, bold: '700' as const,
} as const;
export const shadow = { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 };
