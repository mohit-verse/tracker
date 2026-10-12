export const theme = {
  colors: {
    background: '#101010', // Deep obsidian dark mode background
    surface: '#202020', // Surface card background
    surfaceHighlight: '#282828', // Elevated surface
    surfaceGlass: 'rgba(32, 32, 32, 0.85)', // Liquid glass surface
    border: 'rgba(255, 255, 255, 0.08)', // Subtle border
    borderHighlight: 'rgba(199, 107, 53, 0.3)', // Subtle orange border
    textPrimary: '#FFFFFF',
    textSecondary: '#9E9E9E', // Refined gray
    textMuted: '#616161', // Charcoal muted text
    primary: '#C76B35', // Burnt orange primary accent
    primaryMuted: 'rgba(199, 107, 53, 0.18)', // Orange glass tint
    success: '#36A866', // Positive/success green
    warning: '#C76B35', // Primary burnt orange for warnings
    danger: '#E84C4C', // Risk/negative red
    present: '#36A866', // Present green
    absent: '#E84C4C', // Absent red
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
    full: 9999,
  },
  animation: {
    micro: 150,
    standard: 250,
  }
};

export type Theme = typeof theme;
