import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/src/components/AppIcon';
import { colors } from '@/src/constants/colors';

export function EmptyState({ title, text }: { title: string; text: string }) {
  return <View style={styles.container}><View style={styles.icon}><AppIcon name="history" size={24} color={colors.accentDark} /></View><Text style={styles.title}>{title}</Text><Text style={styles.text}>{text}</Text></View>;
}

const styles = StyleSheet.create({ container: { alignItems: 'center', paddingVertical: 35, paddingHorizontal: 25 }, icon: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }, title: { color: colors.primary, fontSize: 17, fontWeight: '800', textAlign: 'center' }, text: { color: colors.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8 } });
