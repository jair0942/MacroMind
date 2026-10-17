import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/AppIcon';
import { colors } from '@/src/constants/colors';
import { radii, spacing } from '@/src/constants/design';
import type { Meal } from '@/src/types/meal';
import { formatTime } from '@/src/utils/dates';

const labels = { desayuno: 'Desayuno', comida: 'Comida', cena: 'Cena', snack: 'Snack' } as const;
const iconNames = { desayuno: 'home', comida: 'scan', cena: 'history', snack: 'plus' } as const;

export function MealCard({ meal, onPress }: { meal: Meal; onPress?: () => void }) {
  return <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Ver ${labels[meal.mealType]}`}>
    <View style={styles.icon}><AppIcon name={iconNames[meal.mealType]} size={20} color={colors.accentDark} /></View>
    <View style={styles.content}><Text style={styles.title}>{labels[meal.mealType]}</Text><Text style={styles.items} numberOfLines={1}>{meal.items.map((item) => item.name).join(' · ')}</Text></View>
    <View style={styles.right}><Text style={styles.calories}>{Math.round(meal.totals.calories)} kcal</Text><Text style={styles.time}>{formatTime(meal.recordedAt)}</Text></View>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  pressed: { opacity: 0.78 },
  icon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  content: { flex: 1, minWidth: 0 }, title: { color: colors.primary, fontSize: 15, fontWeight: '800' }, items: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  right: { alignItems: 'flex-end', marginLeft: spacing.sm }, calories: { color: colors.primary, fontSize: 13, fontWeight: '800' }, time: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
});
