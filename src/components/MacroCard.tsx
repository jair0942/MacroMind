import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/constants/colors';
import { radii, spacing } from '@/src/constants/design';
import { ratio } from '@/src/utils/calculations';

type Props = { label: string; value: number; goal: number; unit?: string; color: string };

export function MacroCard({ label, value, goal, unit = 'g', color }: Props) {
  const progress = Math.min(1, Math.max(0, ratio(value, goal)));
  return <View style={styles.card} accessible accessibilityLabel={`${label}: ${Math.round(value)} de ${Math.round(goal)} ${unit}`}>
    <View style={[styles.dot, { backgroundColor: color }]} /><Text style={styles.label}>{label}</Text><Text style={styles.value}>{Math.round(value)}<Text style={styles.unit}> / {Math.round(goal)}{unit}</Text></Text><View style={styles.track}><View style={[styles.fill, { backgroundColor: color, width: `${progress * 100}%` }]} /></View>
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, flex: 1, minWidth: '30%', borderWidth: 1, borderColor: colors.border },
  dot: { width: 9, height: 9, borderRadius: 5, marginBottom: spacing.sm },
  label: { color: colors.textMuted, fontSize: 12, marginBottom: 6 },
  value: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  unit: { color: colors.textMuted, fontSize: 11, fontWeight: '500' },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.border, marginTop: spacing.md, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});
