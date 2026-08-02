import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Relative imports reach into the web app's source tree; see metro.config.js.
import { destinations, difficultyMeta } from '../../../src/data/destinations';
import { curatedRoutes } from '../../../src/lib/mapStyle';
import DioramaMap, { type DioramaMapRef } from '../components/diorama-map';
import { BottomTabInset, Spacing } from '../constants/theme';
import { useAppState } from '../lib/app-state';

export default function MapScreen() {
  const { t, language, setLanguage, selectedId, setSelectedId } = useAppState();
  const mapRef = useRef<DioramaMapRef>(null);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const selected = selectedId != null ? destinations.find((d) => d.id === selectedId) ?? null : null;

  useEffect(() => {
    mapRef.current?.showDestination(selected);
  }, [selected]);

  const routeLengthKm = selected
    ? (curatedRoutes[selected.id.toString()]?.properties as { lengthM?: number } | undefined)?.lengthM
    : undefined;

  return (
    <View style={styles.container}>
      <DioramaMap ref={mapRef} onSelect={setSelectedId} />

      {/* Language toggle */}
      <View style={[styles.langRow, { top: insets.top + Spacing.two }]}>
        {(['nb', 'en'] as const).map((lang) => (
          <Pressable
            key={lang}
            onPress={() => setLanguage(lang)}
            style={[styles.langChip, language === lang && styles.langChipActive]}>
            <Text style={[styles.langText, language === lang && styles.langTextActive]}>
              {lang === 'nb' ? 'NO' : 'EN'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Selected destination card */}
      {selected && (
        <View style={[styles.card, { bottom: BottomTabInset + Spacing.three }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.dot, { backgroundColor: difficultyMeta[selected.difficulty].color }]} />
            <Text style={styles.cardTitle} numberOfLines={1}>{selected.name}</Text>
            <Pressable onPress={() => setSelectedId(null)} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.cardMeta}>
            {t(difficultyMeta[selected.difficulty].label)} • {selected.elevation} moh
            {routeLengthKm ? ` • ${(routeLengthKm / 1000).toFixed(1)} km` : ''}
          </Text>
          <Pressable style={styles.detailButton} onPress={() => router.navigate('/turer')}>
            <Text style={styles.detailButtonText}>
              {language === 'nb' ? 'Se detaljer' : 'View details'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a2332' },
  langRow: {
    position: 'absolute',
    right: Spacing.three,
    flexDirection: 'row',
    gap: 6,
  },
  langChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  langChipActive: { backgroundColor: '#333' },
  langText: { fontSize: 12, fontWeight: '700', color: '#333' },
  langTextActive: { color: '#fff' },
  card: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: Spacing.three,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  cardTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  close: { fontSize: 16, color: '#888', paddingHorizontal: 4 },
  cardMeta: { fontSize: 13, color: '#555' },
  detailButton: {
    backgroundColor: '#007bff',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  detailButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
