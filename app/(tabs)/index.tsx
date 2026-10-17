import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/AppIcon';
import { CalorieProgress } from '@/src/components/CalorieProgress';
import { EmptyState } from '@/src/components/EmptyState';
import { MacroCard } from '@/src/components/MacroCard';
import { MealCard } from '@/src/components/MealCard';
import { colors } from '@/src/constants/colors';
import { radii, spacing, typography } from '@/src/constants/design';
import { getDailySummary, getRecentMeals } from '@/src/database/mealRepository';
import { getProfile } from '@/src/database/profileRepository';
import { listWeightEntries, type WeightEntry } from '@/src/database/weightRepository';
import { useAppData } from '@/src/hooks/useAppData';
import type { DailySummary } from '@/src/types/nutrition';
import type { Meal } from '@/src/types/meal';
import type { Profile } from '@/src/types/profile';
import { formatDate } from '@/src/utils/dates';

export default function HomeScreen() {
  const router = useRouter();
  const { ready, error, revision } = useAppData();
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [latestWeight, setLatestWeight] = useState<WeightEntry | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    if (!ready) return;
    setRefreshing(true);
    try { const [nextSummary, nextMeals, nextProfile, weights] = await Promise.all([getDailySummary(), getRecentMeals(4), getProfile(), listWeightEntries()]); setSummary(nextSummary); setMeals(nextMeals); setProfile(nextProfile); setLatestWeight(weights.at(-1) ?? null); }
    finally { setRefreshing(false); }
  }, [ready, revision]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (error) return <SafeAreaView style={styles.center}><Text style={styles.error}>{error}</Text></SafeAreaView>;
  if (!ready || !summary) return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.accentDark} /><Text style={styles.loading}>Preparando tu resumen...</Text></SafeAreaView>;
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.accentDark} />}>
    <View style={styles.header}><View style={styles.identity}><View style={styles.avatar}><Text style={styles.avatarText}>{profile?.name?.slice(0, 1).toUpperCase() || 'M'}</Text></View><View><Text style={styles.greeting}>Buenos días</Text><Text style={styles.name}>{profile?.name ? profile.name : 'Tu resumen'}</Text><Text style={styles.date}>{formatDate()}</Text></View></View><Pressable style={styles.headerButton} onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="Abrir configuración"><AppIcon name="settings" size={22} color={colors.primary} /></Pressable></View>
    {!profile && <Pressable style={styles.profileCta} onPress={() => router.push('/profile')}><View style={styles.ctaIcon}><AppIcon name="profile" size={23} color={colors.primary} /></View><View style={styles.ctaCopy}><Text style={styles.profileCtaTitle}>Completa tu perfil</Text><Text style={styles.profileCtaText}>Añade tus datos para calcular objetivos personalizados.</Text></View><AppIcon name="forward" size={24} color={colors.primary} /></Pressable>}
    <CalorieProgress consumed={summary.calories} goal={summary.goal.calories} />
    <View style={styles.macros}><MacroCard label="Proteína" value={summary.protein} goal={summary.goal.protein} color={colors.accent} /><MacroCard label="Carbohidratos" value={summary.carbohydrates} goal={summary.goal.carbohydrates} color={colors.lavender} /><MacroCard label="Grasa" value={summary.fat} goal={summary.goal.fat} color={colors.primary} /></View>
    {latestWeight && <Pressable style={styles.weightCard} onPress={() => router.push('/progress')}><View><Text style={styles.weightLabel}>Peso más reciente</Text><Text style={styles.weightValue}>{latestWeight.weightKg.toFixed(1)} kg</Text></View><Text style={styles.weightLink}>Ver progreso <AppIcon name="forward" size={15} color={colors.accentDark} /></Text></Pressable>}
    <Pressable style={styles.scanButton} onPress={() => router.push('/scan')} accessibilityRole="button"><View style={styles.scanIcon}><AppIcon name="camera" size={23} color={colors.white} /></View><View><Text style={styles.scanTitle}>Registrar una comida</Text><Text style={styles.scanSubtitle}>Analiza una foto o añade los datos manualmente</Text></View><AppIcon name="forward" size={25} color={colors.white} /></Pressable>
    <View style={styles.sectionHeader}><View><Text style={styles.sectionEyebrow}>HOY</Text><Text style={styles.sectionTitle}>Comidas registradas</Text></View><Pressable onPress={() => router.push('/history')} accessibilityRole="button"><Text style={styles.link}>Ver historial</Text></Pressable></View>
    {meals.length ? meals.map((meal) => <MealCard key={meal.id} meal={meal} onPress={() => router.push({ pathname: '/analysis', params: { mealId: String(meal.id) } })} />) : <View style={styles.emptyCard}><EmptyState title="Tu día empieza aquí" text="Registra tu primera comida para ver tu resumen nutricional." /></View>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.xl, paddingBottom: 36 }, center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 25 }, loading: { color: colors.textMuted, marginTop: spacing.md }, error: { color: colors.danger, textAlign: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl }, identity: { flexDirection: 'row', alignItems: 'center' }, avatar: { width: 48, height: 48, borderRadius: 17, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }, avatarText: { color: colors.primary, fontSize: 19, fontWeight: '800' }, greeting: { color: colors.textMuted, fontSize: 12 }, name: { color: colors.primary, fontSize: 20, fontWeight: '800', marginTop: 2 }, date: { color: colors.textMuted, fontSize: 11, marginTop: 3, textTransform: 'capitalize' }, headerButton: { width: 44, height: 44, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  profileCta: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.lavenderSoft, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.md }, ctaIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }, ctaCopy: { flex: 1 }, profileCtaTitle: { color: colors.primary, fontSize: 14, fontWeight: '800' }, profileCtaText: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  macros: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }, weightCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border }, weightLabel: { color: colors.textMuted, fontSize: 11 }, weightValue: { color: colors.primary, fontSize: 20, fontWeight: '800', marginTop: 4 }, weightLink: { color: colors.accentDark, fontSize: 11, fontWeight: '800' },
  scanButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accent, borderRadius: radii.md, padding: spacing.lg, marginTop: spacing.xl }, scanIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.accentDark, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }, scanTitle: { color: colors.primary, fontSize: 15, fontWeight: '800' }, scanSubtitle: { color: '#70463D', fontSize: 11, marginTop: 3, maxWidth: 220 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 30, marginBottom: spacing.md }, sectionEyebrow: { color: colors.accentDark, ...typography.eyebrow }, sectionTitle: { color: colors.primary, fontSize: 19, fontWeight: '800', marginTop: 5 }, link: { color: colors.accentDark, fontSize: 12, fontWeight: '800', marginBottom: 2 }, emptyCard: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border },
});
