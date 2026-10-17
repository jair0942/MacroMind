import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/constants/colors';
import { radii, shadows, spacing } from '@/src/constants/design';
import { ratio } from '@/src/utils/calculations';

export function CalorieProgress({ consumed, goal }: { consumed: number; goal: number }) {
  const progress = Math.min(1, Math.max(0, ratio(consumed, goal)));
  const difference = goal - consumed;
  const segments = 28;
  return <View style={styles.card} accessible accessibilityLabel={`${Math.round(consumed)} calorías de ${Math.round(goal)} objetivo`}>
    <View style={styles.row}><View><Text style={styles.eyebrow}>RESUMEN DIARIO</Text><Text style={styles.caption}>Calorías consumidas</Text></View><Text style={[styles.remaining, difference < 0 && styles.over]}>{difference >= 0 ? `${Math.round(difference)} restantes` : `${Math.round(Math.abs(difference))} sobre la meta`}</Text></View>
    <View style={styles.ringWrap}><View style={styles.ringBase} />{Array.from({ length: segments }, (_, index) => <View key={index} style={[styles.segment, { backgroundColor: index < Math.ceil(progress * segments) ? colors.accent : colors.border, transform: [{ rotate: `${index * (360 / segments)}deg` }, { translateY: -46 }] }]} />)}<View style={styles.ringCenter}><Text style={styles.value}>{Math.round(consumed)}</Text><Text style={styles.goal}>de {Math.round(goal)} kcal</Text></View></View>
    <View style={styles.footer}><View style={styles.legend}><View style={styles.dot} /><Text style={styles.legendText}>Consumido</Text></View><Text style={styles.footerText}>{Math.round(progress * 100)}% de tu objetivo</Text></View>
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.primary, borderRadius: radii.lg, padding: spacing.xl, ...shadows.soft },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { color: '#BFD4D0', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  caption: { color: colors.white, fontSize: 15, fontWeight: '700', marginTop: 6 },
  remaining: { color: '#F6C5B8', fontSize: 12, fontWeight: '800', marginTop: 3 },
  over: { color: '#FFD3A8' },
  ringWrap: { width: 196, height: 196, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  ringBase: { position: 'absolute', width: 164, height: 164, borderRadius: 82, borderWidth: 9, borderColor: 'rgba(255,255,255,0.17)' },
  segment: { position: 'absolute', left: '50%', top: '50%', width: 6, height: 15, borderRadius: 3, marginLeft: -3, marginTop: -7.5 },
  ringCenter: { alignItems: 'center' },
  value: { color: colors.white, fontSize: 36, fontWeight: '800' },
  goal: { color: '#BFD4D0', fontSize: 12, marginTop: 2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  legendText: { color: '#BFD4D0', fontSize: 11 },
  footerText: { color: colors.white, fontSize: 11, fontWeight: '700' },
});
