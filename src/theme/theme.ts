export const theme = {
  colors: {
    background: '#0F1115', // very dark blue-grey
    surface: '#16191F', // slightly lighter surface
    surfaceHighlight: '#22262E',
    border: '#2C313D',
    textPrimary: '#FFFFFF',
    textSecondary: '#8B949E',
    textMuted: '#525964',
    primary: '#58A6FF', // Developer blue
    success: '#3FB950', // Green
    warning: '#D29922', // Yellow/Orange
    danger: '#F85149', // Red
    present: '#2EA043',
    absent: '#DA3633',
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
