export const colors = {
  background: '#F7F4EE',
  surface: '#FFFFFF',
  surfaceElevated: '#F1EEE8',
  border: '#E7E3DB',
  text: '#253238',
  textMuted: '#6F7778',
  primary: '#173C46',
  primarySoft: '#E7F0EF',
  accent: '#E58A72',
  accentSoft: '#FBE6DF',
  lavender: '#D9CFF1',
  lavenderSoft: '#F0ECFA',
  accentDark: '#B85D4B',
  success: '#397E70',
  warning: '#B66B2E',
  danger: '#B84F4F',
  white: '#FFFFFF',
} as const;

export type ColorName = keyof typeof colors;
