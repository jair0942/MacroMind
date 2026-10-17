import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/constants/colors';
import { AppDataProvider, useAppData } from '@/src/hooks/useAppData';
import { getAuthRedirect } from '@/src/utils/authRouting';

function AppNavigator() {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, authenticated, error, profile, refresh } = useAppData();
  const onOnboardingRoute = pathname === '/onboarding';
  const onAuthRoute = pathname === '/auth';
  const redirect = getAuthRedirect({ ready, error, authenticated, profileCompleted: profile?.onboardingCompleted === true, pathname });

  useEffect(() => {
    if (redirect) router.replace(redirect as never);
  }, [redirect, router]);

  if (error) return <AppStateScreen message={`No se pudo iniciar MacroMind: ${error}`} error onRetry={() => void refresh()} />;
  if (!ready) return <AppStateScreen message="Preparando tu espacio local..." />;
  if (!authenticated && !onAuthRoute) return <AppStateScreen message="Abriendo el acceso local..." />;
  if (!authenticated && onOnboardingRoute) return <AppStateScreen message="Redirigiendo al acceso local..." />;
  if (authenticated && profile?.onboardingCompleted && onOnboardingRoute) return <AppStateScreen message="Abriendo tu resumen..." />;
  if (authenticated && !profile?.onboardingCompleted && !onOnboardingRoute) return <AppStateScreen message="Abriendo tu configuración inicial..." />;

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}

function AppStateScreen({ message, error = false, onRetry }: { message: string; error?: boolean; onRetry?: () => void }) {
  return <SafeAreaView style={styles.safe}><View style={styles.center}><View style={styles.logo}><Text style={styles.logoText}>M</Text></View>{!error && <ActivityIndicator color={colors.accentDark} />}<Text style={[styles.message, error && styles.error]}>{message}</Text>{onRetry && <Pressable style={styles.retry} onPress={onRetry}><Text style={styles.retryText}>Reintentar</Text></Pressable>}</View></SafeAreaView>;
}

export default function RootLayout() {
  return <AppDataProvider><StatusBar style="dark" /><AppNavigator /></AppDataProvider>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  logo: { width: 72, height: 72, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  logoText: { color: colors.white, fontSize: 34, fontWeight: '800' },
  message: { color: colors.textMuted, textAlign: 'center', marginTop: 14, lineHeight: 20 },
  error: { color: colors.danger },
  retry: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 22, marginTop: 18 },
  retryText: { color: colors.white, fontWeight: '800' },
});
