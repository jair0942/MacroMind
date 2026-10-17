import { StyleSheet, Text, type ColorValue } from 'react-native';

import { colors } from '@/src/constants/colors';

export type IconName = 'home' | 'scan' | 'history' | 'stats' | 'profile' | 'settings' | 'camera' | 'gallery' | 'back' | 'forward' | 'plus' | 'search' | 'calendar' | 'check' | 'close' | 'more';

const glyphs: Record<IconName, string> = {
  home: '⌂', scan: '＋', history: '▤', stats: '↗', profile: '○', settings: '⚙', camera: '▣', gallery: '▧', back: '‹', forward: '›', plus: '＋', search: '⌕', calendar: '□', check: '✓', close: '×', more: '⋯',
};

export function AppIcon({ name, size = 22, color = colors.primary }: { name: IconName; size?: number; color?: ColorValue }) {
  return <Text style={[styles.icon, { color, fontSize: size, lineHeight: size + 3 }]} accessible={false}>{glyphs[name]}</Text>;
}

const styles = StyleSheet.create({ icon: { fontWeight: '500', textAlign: 'center' } });
