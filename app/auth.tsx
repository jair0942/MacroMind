import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppIcon } from '@/src/components/AppIcon';
import { Button, LoadingState, ScreenHeader, Surface, Tag } from '@/src/components/Design';
import { colors } from '@/src/constants/colors';
import { radii, spacing, typography } from '@/src/constants/design';
import { authenticateUser, claimLegacyUser, registerUser } from '@/src/database/userRepository';
import { useAppData } from '@/src/hooks/useAppData';

type Mode = 'login' | 'register' | 'claim';

export default function AuthScreen() {
  const { ready, users, login } = useAppData();
  const [mode, setMode] = useState<Mode>('login');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const submitInFlight = useRef(false);
  const legacyAvailable = useMemo(() => users.some((user) => !user.hasPassword), [users]);

  const submit = async (): Promise<void> => {
    if (busy || submitInFlight.current) return;
    submitInFlight.current = true;
    setBusy(true); setMessage(null);
    try {
      if ((mode === 'register' || mode === 'claim') && password !== confirmation) throw new Error('Las contraseñas no coinciden.');
      if (mode === 'login') {
        const user = await authenticateUser(username, password);
        await login(user.id);
      } else if (mode === 'register') {
        const user = await registerUser(displayName, username, password);
        await login(user.id);
      } else {
        const user = await claimLegacyUser(username, password);
        await login(user.id);
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'No se pudo completar el acceso.');
    } finally {
      submitInFlight.current = false;
      setBusy(false);
    }
  };
  if (!ready) return <SafeAreaView style={styles.safe}><LoadingState label="Preparando el acceso local..." /></SafeAreaView>;
  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.brand}><View style={styles.logo}><Text style={styles.logoText}>M</Text></View><Text style={styles.brandName}>MacroMind</Text></View>
    <ScreenHeader eyebrow="ACCESO LOCAL" title={mode === 'login' ? 'Entra a tu espacio' : mode === 'claim' ? 'Recupera tu historial' : 'Crea tu espacio'} subtitle="Cada persona tiene su propio perfil, comidas, objetivos y pesajes en este dispositivo." />
    {mode === 'login' && <Surface tone="soft" style={styles.info}><AppIcon name="check" size={18} color={colors.success} /><Text style={styles.infoText}>{users.filter((user) => user.hasPassword).length ? 'Usa el usuario y la contraseña que registraste.' : 'Todavía no hay usuarios con contraseña. Crea el primero para comenzar.'}</Text></Surface>}
    {mode === 'claim' && <Surface tone="lavender" style={styles.info}><Tag>HISTORIAL EXISTENTE</Tag><Text style={styles.infoText}>Encontramos datos creados antes del inicio de sesión. Configura credenciales para conservarlos bajo tu nuevo acceso.</Text></Surface>}
    {mode === 'register' && <Field label="Nombre visible" value={displayName} onChangeText={setDisplayName} placeholder="Tu nombre o apodo" autoCapitalize="words" />}
    <Field label="Usuario" value={username} onChangeText={setUsername} placeholder="ejemplo_2026" autoCapitalize="none" autoCorrect={false} />
    <Field label="Contraseña" value={password} onChangeText={setPassword} placeholder="Mínimo 6 caracteres" secureTextEntry />
    {(mode === 'register' || mode === 'claim') && <Field label="Repite la contraseña" value={confirmation} onChangeText={setConfirmation} placeholder="Vuelve a escribirla" secureTextEntry />}
    {message && <Text style={styles.message}>{message}</Text>}
    <Button label={busy ? 'Comprobando...' : mode === 'login' ? 'Iniciar sesión' : mode === 'claim' ? 'Guardar acceso e ingresar' : 'Crear usuario'} onPress={() => void submit()} disabled={busy} icon={<AppIcon name="forward" size={18} color={colors.white} />} style={styles.primaryButton} />
    {mode === 'login' && <Button label="Crear un usuario nuevo" onPress={() => { setMode('register'); setMessage(null); }} variant="quiet" />}
    {mode !== 'login' && <Button label="Ya tengo un usuario" onPress={() => { setMode('login'); setMessage(null); }} variant="quiet" />}
    {mode === 'login' && legacyAvailable && <Button label="Configurar acceso a mi historial anterior" onPress={() => { setMode('claim'); setMessage(null); }} variant="secondary" icon={<AppIcon name="history" size={18} color={colors.accentDark} />} />}
    <Text style={styles.privacy}>El acceso es local al dispositivo. MacroMind no crea cuentas en internet ni sincroniza contraseñas.</Text>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

function Field({ label, value, onChangeText, placeholder, secureTextEntry = false, autoCapitalize = 'none', autoCorrect = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; secureTextEntry?: boolean; autoCapitalize?: 'none' | 'words'; autoCorrect?: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textMuted} style={styles.input} autoCapitalize={autoCapitalize} autoCorrect={autoCorrect} secureTextEntry={secureTextEntry} maxLength={120} accessibilityLabel={label} /></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, content: { padding: spacing.xl, paddingBottom: 40 }, brand: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xxl }, logo: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md }, logoText: { color: colors.white, fontSize: 22, fontWeight: '900' }, brandName: { color: colors.primary, fontSize: 18, fontWeight: '900' }, info: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg }, infoText: { flex: 1, color: colors.textMuted, ...typography.caption }, field: { marginTop: spacing.md }, label: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm }, input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, color: colors.primary, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: 15 }, message: { color: colors.danger, fontSize: 12, lineHeight: 18, marginTop: spacing.md }, primaryButton: { marginTop: spacing.xl }, privacy: { color: colors.textMuted, textAlign: 'center', fontSize: 11, lineHeight: 17, marginTop: spacing.xl },
});
