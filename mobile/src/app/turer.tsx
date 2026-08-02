import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Relative imports reach into the web app's source tree; see metro.config.js.
import {
  destinations,
  difficultyMeta,
  type Destination,
  type DifficultyLevel,
} from '../../../src/data/destinations';
import { curatedRoutes } from '../../../src/lib/mapStyle';
import { BottomTabInset, Spacing } from '../constants/theme';
import { useAppState } from '../lib/app-state';

export default function TurerScreen() {
  const { t, language, selectedId, setSelectedId } = useAppState();
  const [filterAge, setFilterAge] = useState<number | null>(null);
  const [filterDifficulty, setFilterDifficulty] = useState<DifficultyLevel | null>(null);

  const selected = selectedId != null ? destinations.find((d) => d.id === selectedId) ?? null : null;

  const filtered = destinations.filter((d) => {
    const ageMatch = !filterAge || d.childSuitability >= (filterAge === 6 ? 7 : filterAge === 9 ? 4 : 0);
    const difficultyMatch = !filterDifficulty || d.difficulty === filterDifficulty;
    return ageMatch && difficultyMatch;
  });

  if (selected) {
    return <DestinationDetail dest={selected} onBack={() => setSelectedId(null)} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Text style={styles.heading}>Ranatrasken</Text>
      <Text style={styles.subheading}>
        {language === 'nb' ? `Viser ${filtered.length} av 30 turer` : `Showing ${filtered.length} of 30 trips`}
      </Text>

      {/* Difficulty filter chips */}
      <View style={styles.filterRow}>
        {(Object.keys(difficultyMeta) as DifficultyLevel[]).map((level) => {
          const active = filterDifficulty === level;
          return (
            <Pressable
              key={level}
              onPress={() => setFilterDifficulty(active ? null : level)}
              style={[styles.chip, active && { backgroundColor: difficultyMeta[level].color }]}>
              <View style={[styles.dot, { backgroundColor: active ? '#fff' : difficultyMeta[level].color }]} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {t(difficultyMeta[level].label).split(' ')[0]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Child suitability filter */}
      <View style={styles.filterRow}>
        {([{ v: 6, nb: 'Fra 6 år', en: 'Ages 6+' }, { v: 9, nb: 'Fra 9 år', en: 'Ages 9+' }, { v: null, nb: 'Alle', en: 'All' }] as const).map((opt) => {
          const active = filterAge === opt.v;
          return (
            <Pressable
              key={String(opt.v)}
              onPress={() => setFilterAge(opt.v)}
              style={[styles.chip, active && styles.chipDark]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {language === 'nb' ? opt.nb : opt.en}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(d) => d.id.toString()}
        contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.three, gap: 8 }}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => setSelectedId(item.id)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.name}</Text>
              <Text style={styles.rowMeta}>
                {item.elevation} moh •{' '}
                <Text style={{ color: difficultyMeta[item.difficulty].color, fontWeight: '700' }}>
                  {t(difficultyMeta[item.difficulty].label).split(' ')[0].toUpperCase()}
                </Text>
              </Text>
            </View>
            <View style={[styles.dot, { backgroundColor: difficultyMeta[item.difficulty].color }]} />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

function DestinationDetail({ dest, onBack }: { dest: Destination; onBack: () => void }) {
  const { t, language } = useAppState();
  const router = useRouter();
  const meta = difficultyMeta[dest.difficulty];
  const routeLengthM = (curatedRoutes[dest.id.toString()]?.properties as { lengthM?: number } | undefined)?.lengthM;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.three, gap: Spacing.three }}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={styles.back}>← {language === 'nb' ? 'Tilbake til listen' : 'Back to list'}</Text>
        </Pressable>

        <Text style={styles.heading}>{dest.name}</Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: meta.color }]}>
            <Text style={styles.badgeText}>{t(meta.label)}</Text>
          </View>
          <Text style={styles.rowMeta}>{dest.elevation} moh</Text>
          {routeLengthM != null && (
            <Text style={styles.rowMeta}>{(routeLengthM / 1000).toFixed(1)} km</Text>
          )}
        </View>

        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            router.navigate('/');
          }}>
          <Text style={styles.primaryButtonText}>
            {language === 'nb' ? 'Vis på kart' : 'Show on map'}
          </Text>
        </Pressable>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {language === 'nb' ? 'Beskrivelse av turen' : 'Description'}
          </Text>
          <Text style={styles.body}>{t(dest.description)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {language === 'nb' ? 'Hvordan kommer vi oss dit' : 'How to get there'}
          </Text>
          <Text style={styles.body}>{t(dest.howToGetThere)}</Text>
        </View>

        <Text style={styles.suitability}>{t(meta.suitability)}</Text>

        {dest.parking && (
          <View style={styles.parkingCard}>
            <Text style={styles.parkingTitle}>
              🅿️ {language === 'nb' ? 'Anbefalt parkering' : 'Recommended parking'}
            </Text>
            <Text style={styles.parkingName}>{dest.parking.name}</Text>
            <Text style={styles.body}>{t(dest.parking.description)}</Text>
            <Pressable
              style={styles.secondaryButton}
              onPress={() =>
                Linking.openURL(
                  `https://www.google.com/maps/dir/?api=1&destination=${dest.parking!.lat},${dest.parking!.lng}&travelmode=driving`
                )
              }>
              <Text style={styles.secondaryButtonText}>
                {language === 'nb' ? 'Åpne veibeskrivelse til parkering' : 'Open driving directions'}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fcfcfc', paddingHorizontal: Spacing.three },
  heading: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', marginTop: Spacing.two },
  subheading: { fontSize: 13, color: '#666', marginBottom: Spacing.two },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.two },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    backgroundColor: '#fff',
  },
  chipDark: { backgroundColor: '#333', borderColor: '#333' },
  chipText: { fontSize: 12, color: '#333' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
  },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  rowMeta: { fontSize: 12, color: '#888' },
  back: { fontSize: 13, color: '#555' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  section: { gap: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  body: { fontSize: 13, color: '#444', lineHeight: 19 },
  suitability: { fontSize: 12, fontStyle: 'italic', color: '#777' },
  parkingCard: {
    backgroundColor: '#e7f1ff',
    borderColor: '#b8daff',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  parkingTitle: { fontSize: 13, fontWeight: '700', color: '#004085' },
  parkingName: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
  primaryButton: {
    backgroundColor: '#007bff',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  secondaryButton: {
    borderColor: '#007bff',
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: '#fff',
  },
  secondaryButtonText: { color: '#007bff', fontSize: 12, fontWeight: '600' },
});
