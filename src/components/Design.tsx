import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/constants/colors';
import { radii, shadows, spacing, typography } from '@/src/constants/design';

export function ScreenHeader({ eyebrow, title, subtitle, right }: { eyebrow?: string; title: string; subtitle?: string; right?: ReactNode }) {
  return <View style={styles.header}><View style={styles.headerCopy}>{eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}<Text style={styles.title}>{title}</Text>{subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}</View>{right}</View>;
}

export function Surface({ children, tone = 'white', style }: PropsWithChildren<{ tone?: 'white' | 'soft' | 'primary' | 'lavender'; style?: object }>) {
  return <View style={[styles.surface, tone === 'soft' && styles.surfaceSoft, tone === 'primary' && styles.surfacePrimary, tone === 'lavender' && styles.surfaceLavender, style]}>{children}</View>;
}

export function Button({ label, onPress, variant = 'primary', disabled = false, icon, style }: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'quiet' | 'danger'; disabled?: boolean; icon?: ReactNode; style?: object }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, styles[`button${variant[0].toUpperCase()}${variant.slice(1)}` as keyof typeof styles], pressed && styles.pressed, disabled && styles.disabled, style]}>{icon}{<Text style={styles[`buttonText${variant[0].toUpperCase()}${variant.slice(1)}` as keyof typeof styles]}>{label}</Text>}</Pressable>;
}

export function Tag({ children, tone = 'soft' }: PropsWithChildren<{ tone?: 'soft' | 'coral' | 'primary' }>) {
  return <View style={[styles.tag, tone === 'coral' && styles.tagCoral, tone === 'primary' && styles.tagPrimary]}><Text style={[styles.tagText, tone === 'primary' && styles.tagTextPrimary]}>{children}</Text></View>;
}

export function LoadingState({ label = 'Cargando...' }: { label?: string }) {
  return <View style={styles.loading}><ActivityIndicator color={colors.accentDark} /><Text style={styles.loadingText}>{label}</Text></View>;
}

export function Divider() { return <View style={styles.divider} />; }

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.xl },
  headerCopy: { flex: 1, paddingRight: spacing.md },
  eyebrow: { color: colors.accentDark, ...typography.eyebrow },
  title: { color: colors.primary, ...typography.title, marginTop: spacing.sm },
  subtitle: { color: colors.textMuted, ...typography.body, marginTop: spacing.sm },
  surface: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, ...shadows.soft },
  surfaceSoft: { backgroundColor: colors.surfaceElevated, shadowOpacity: 0 },
  surfacePrimary: { backgroundColor: colors.primary, shadowOpacity: 0 },
  surfaceLavender: { backgroundColor: colors.lavender, shadowOpacity: 0 },
  button: { minHeight: 50, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radii.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent },
  buttonQuiet: { backgroundColor: colors.surfaceElevated },
  buttonDanger: { backgroundColor: '#F8E2E0' },
  buttonTextPrimary: { color: colors.white, fontSize: 14, fontWeight: '800' },
  buttonTextSecondary: { color: colors.accentDark, fontSize: 14, fontWeight: '800' },
  buttonTextQuiet: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  buttonTextDanger: { color: colors.danger, fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.5 },
  tag: { alignSelf: 'flex-start', backgroundColor: colors.primarySoft, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  tagCoral: { backgroundColor: colors.accentSoft },
  tagPrimary: { backgroundColor: 'rgba(255,255,255,0.16)' },
  tagText: { color: colors.success, fontSize: 11, fontWeight: '800' },
  tagTextPrimary: { color: colors.white },
  loading: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  loadingText: { color: colors.textMuted, marginTop: spacing.md, ...typography.caption },
  divider: { height: 1, backgroundColor: colors.border },
});
