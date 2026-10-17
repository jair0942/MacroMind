import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/AppIcon';
import { Button, Surface } from '@/src/components/Design';
import { colors } from '@/src/constants/colors';
import { config } from '@/src/constants/config';
import { radii, spacing, typography } from '@/src/constants/design';

export default function ScanScreen() {
  const router = useRouter();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const chooseInFlight = useRef(false);
  const choose = async (source: 'camera' | 'gallery') => {
    if (chooseInFlight.current) return;
    chooseInFlight.current = true;
    setChoosing(true);
    setError(null);
    try {
      const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { setError('Necesitamos permiso para acceder a la imagen. Puedes habilitarlo desde Ajustes.'); return; }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85, allowsEditing: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85, allowsEditing: true });
      if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
    } catch { setError('No se pudo abrir la imagen. Inténtalo de nuevo.'); }
  finally {
    chooseInFlight.current = false;
    setChoosing(false);
  }
  };
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>NUEVO REGISTRO</Text><Text style={styles.title}>Registra lo que comiste</Text><Text style={styles.subtitle}>Una fotografía ayuda a identificar ingredientes y preparar una revisión más rápida.</Text>
    {imageUri ? <Surface style={styles.previewCard}><Image source={{ uri: imageUri }} style={styles.preview} /><View style={styles.previewFooter}><View><Text style={styles.previewTitle}>Foto lista para revisar</Text><Text style={styles.previewText}>Podrás corregir alimentos y gramos antes de guardar.</Text></View><Pressable onPress={() => setImageUri(null)} accessibilityRole="button" accessibilityLabel="Elegir otra fotografía"><AppIcon name="close" size={22} color={colors.primary} /></Pressable></View></Surface> : <View style={styles.actions}><Pressable style={({ pressed }) => [styles.actionCard, pressed && styles.pressed, choosing && styles.disabled]} onPress={() => void choose('camera')} disabled={choosing}><View style={styles.actionIcon}><AppIcon name="camera" size={25} color={colors.primary} /></View><Text style={styles.actionTitle}>Cámara</Text><Text style={styles.actionText}>Tomar una foto</Text></Pressable><Pressable style={({ pressed }) => [styles.actionCard, pressed && styles.pressed, choosing && styles.disabled]} onPress={() => void choose('gallery')} disabled={choosing}><View style={[styles.actionIcon, styles.galleryIcon]}><AppIcon name="gallery" size={25} color={colors.primary} /></View><Text style={styles.actionTitle}>Galería</Text><Text style={styles.actionText}>Elegir una imagen</Text></Pressable></View>}
    {error && <Text style={styles.error}>{error}</Text>}
    <Button label={imageUri ? 'Revisar esta comida' : 'Registrar manualmente'} onPress={() => imageUri ? router.push({ pathname: '/analysis', params: { imageUri } }) : router.push('/analysis')} icon={<AppIcon name={imageUri ? 'forward' : 'plus'} size={20} color={colors.white} />} disabled={choosing} style={styles.primary} />
    <Surface tone="soft" style={styles.noteCard}><Text style={styles.noteTitle}>{config.demoMode ? 'Modo demo activo' : 'Análisis orientativo'}</Text><Text style={styles.note}>{config.demoMode ? 'La demostración usa datos ficticios y está marcada antes de guardar.' : 'La imagen no mide gramos exactos. Revisa aceite, salsas, ingredientes y preparación antes de confirmar.'}</Text></Surface>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.xl, paddingBottom: 40 }, eyebrow: { color: colors.accentDark, ...typography.eyebrow }, title: { color: colors.primary, ...typography.title, marginTop: spacing.sm }, subtitle: { color: colors.textMuted, ...typography.body, marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }, actionCard: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, flex: 1, minHeight: 160 }, pressed: { opacity: 0.8 }, disabled: { opacity: 0.55 }, actionIcon: { width: 48, height: 48, borderRadius: 17, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg }, galleryIcon: { backgroundColor: colors.lavender }, actionTitle: { color: colors.primary, fontSize: 16, fontWeight: '800' }, actionText: { color: colors.textMuted, fontSize: 12, marginTop: 5 },
  previewCard: { marginTop: spacing.xl, padding: spacing.sm }, preview: { width: '100%', height: 260, borderRadius: radii.md }, previewFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md }, previewTitle: { color: colors.primary, fontSize: 14, fontWeight: '800' }, previewText: { color: colors.textMuted, fontSize: 11, marginTop: 3 }, error: { color: colors.danger, fontSize: 13, lineHeight: 19, marginTop: spacing.md }, primary: { marginTop: spacing.xl }, noteCard: { marginTop: spacing.lg, padding: spacing.lg }, noteTitle: { color: colors.primary, fontSize: 13, fontWeight: '800' }, note: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 5 },
});
