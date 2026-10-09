export const theme = {
  colors: {
    background: '#050505', // Deep black
    surface: 'rgba(255, 255, 255, 0.05)', // Glassy surface
    surfaceHighlight: 'rgba(255, 255, 255, 0.08)',
    border: 'rgba(255, 255, 255, 0.12)',
    textPrimary: '#FFFFFF',
    textSecondary: '#A1A1AA', // Zinc 400
    textMuted: '#52525B', // Zinc 600
    primary: '#F97316', // Burnt Orange
    primaryMuted: 'rgba(249, 115, 22, 0.2)', // Orange glass
    success: '#10B981', // Emerald
    warning: '#F97316', // Using orange for warnings
    danger: '#EF4444', // Red
    present: '#10B981',
    absent: '#EF4444',
  },
  spacing: {
    xs: 4,
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
    xxl: 48,
  },
  typography: {
    sizes: {
      xs: 12,
      s: 14,
      m: 16,
      l: 20,
      xl: 24,
      xxl: 32,
    },
    weights: {
      regular: '400' as const,
      medium: '500' as const,
      semiBold: '600' as const,
      bold: '700' as const,
    },
  },
  borderRadius: {
    s: 4,
    m: 8,
    l: 12,
    xl: 16,
    round: 9999,
  },
  animation: {
    micro: 150,
    standard: 250,
  }
};

export type Theme = typeof theme;
