import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Button,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabaseClient';

export type ExploreScreenProps = NativeStackScreenProps<RootStackParamList, 'Explore'>;

interface ExploreProfile {
  id: string;
  name: string | null;
  age: number | null;
  gender: string | null;
  city: string | null;
  country: string | null;
  photos: string[] | null;
}

export const ExploreScreen: React.FC<ExploreScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female' | 'other'>('all');
  const [locationFilter, setLocationFilter] = useState('');
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<ExploreProfile[]>([]);
  const [info, setInfo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (genderFilter !== 'all') count += 1;
    if (locationFilter.trim()) count += 1;
    if (minAge) count += 1;
    if (maxAge) count += 1;
    return count;
  }, [genderFilter, locationFilter, minAge, maxAge]);

  const handleSearch = async () => {
    if (!user) return;

    setLoading(true);
    setInfo('');
    try {
      let query = supabase
        .from('profiles')
        .select('id, name, age, gender, city, country, photos')
        .eq('is_complete', true)
        .neq('id', user.id)
        .limit(50);

      if (genderFilter !== 'all') {
        query = query.eq('gender', genderFilter);
      }

      if (locationFilter.trim()) {
        const loc = locationFilter.trim();
        query = query.or(`city.ilike.%${loc}%,country.ilike.%${loc}%`);
      }

      if (minAge) {
        query = query.gte('age', Number(minAge));
      }
      if (maxAge) {
        query = query.lte('age', Number(maxAge));
      }

      const { data, error } = await query;
      if (error) {
        setInfo(error.message);
        setProfiles([]);
        return;
      }

      setProfiles((data as ExploreProfile[]) ?? []);
      if (!data || data.length === 0) {
        setInfo('No profiles found with these filters.');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: ExploreProfile }) => {
    const mainPhoto = item.photos && item.photos[0];
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ViewUserProfile', { userId: item.id })}
      >
        {mainPhoto ? (
          <Image source={{ uri: mainPhoto }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder} />
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.name}>
            {item.name ?? 'Unknown'}
            {item.age ? `, ${item.age}` : ''}
          </Text>
          {!!item.city && !!item.country && (
            <Text style={styles.meta}>
              {item.city}, {item.country}
            </Text>
          )}
          {!!item.gender && <Text style={styles.meta}>{item.gender}</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Text style={styles.headerBack}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Explore</Text>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setFiltersOpen((prev) => !prev)}
          >
            <Text style={styles.headerFilterIcon}>⚙️</Text>
            {activeFilterCount > 0 && (
              <View style={styles.headerFilterBadge}>
                <Text style={styles.headerFilterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.filterSummaryRow}>
            <View style={styles.filterChipsRow}>
              {genderFilter !== 'all' && (
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryChipText}>{genderFilter}</Text>
                </View>
              )}
              {!!locationFilter.trim() && (
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryChipText}>{locationFilter.trim()}</Text>
                </View>
              )}
              {(minAge || maxAge) && (
                <View style={styles.summaryChip}>
                  <Text style={styles.summaryChipText}>
                    Age {minAge || '18'}-{maxAge || '80+'}
                  </Text>
                </View>
              )}
              {activeFilterCount === 0 && (
                <Text style={styles.summaryPlaceholder}>No filters applied</Text>
              )}
            </View>
            <TouchableOpacity onPress={() => setFiltersOpen((prev) => !prev)}>
              <Text style={styles.editFiltersText}>Edit filters</Text>
            </TouchableOpacity>
          </View>

          {filtersOpen && (
            <View style={styles.filterCard}>
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Show me</Text>
                <View style={styles.chipRow}>
                  {(['all', 'male', 'female', 'other'] as const).map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.chip, genderFilter === g && styles.chipSelected]}
                      onPress={() => setGenderFilter(g)}
                    >
                      <Text style={genderFilter === g ? styles.chipTextSelected : styles.chipText}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Location</Text>
                <TextInput
                  style={styles.input}
                  placeholder="City or country..."
                  placeholderTextColor="#9CA3AF"
                  value={locationFilter}
                  onChangeText={setLocationFilter}
                />
                <Text style={styles.helperText}>Partial matches work too.</Text>
              </View>

              <View style={styles.filterSectionRow}>
                <View style={styles.filterColumnHalf}>
                  <Text style={styles.filterLabel}>Min age</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={minAge}
                    onChangeText={setMinAge}
                  />
                </View>
                <View style={styles.filterColumnHalf}>
                  <Text style={styles.filterLabel}>Max age</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={maxAge}
                    onChangeText={setMaxAge}
                  />
                </View>
              </View>

              <View style={styles.filterActionsRow}>
                <TouchableOpacity
                  onPress={() => {
                    setGenderFilter('all');
                    setLocationFilter('');
                    setMinAge('');
                    setMaxAge('');
                  }}
                >
                  <Text style={styles.clearAllText}>Clear all</Text>
                </TouchableOpacity>
                <View style={styles.filterApplyButtonWrapper}>
                  <Button title="Apply filters" onPress={handleSearch} disabled={loading} />
                </View>
              </View>
            </View>
          )}

          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator />
            </View>
          )}

          {!!info && <Text style={styles.info}>{info}</Text>}

          <FlatList
            data={profiles}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerButton: {
    padding: 4,
  },
  headerBack: {
    fontSize: 18,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  headerFilterIcon: {
    fontSize: 18,
  },
  headerFilterBadge: {
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: '#F97316',
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  headerFilterBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  filterSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
  },
  summaryChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    marginRight: 6,
    marginBottom: 6,
  },
  summaryChipText: {
    fontSize: 12,
    color: '#374151',
  },
  summaryPlaceholder: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  editFiltersText: {
    fontSize: 13,
    color: '#6366F1',
    fontWeight: '500',
    marginLeft: 8,
  },
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterSectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  filterColumnHalf: {
    flex: 1,
    marginRight: 8,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    color: '#111827',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  chipSelected: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  chipText: {
    color: '#111827',
  },
  chipTextSelected: {
    color: '#fff',
  },
  loadingRow: {
    marginVertical: 8,
    alignItems: 'center',
  },
  info: {
    textAlign: 'center',
    color: '#555',
    marginBottom: 8,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  photo: {
    width: '100%',
    height: 150,
  },
  photoPlaceholder: {
    width: '100%',
    height: 150,
    backgroundColor: '#E5E7EB',
  },
  cardInfo: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
    color: '#111827',
  },
  meta: {
    fontSize: 12,
    color: '#6B7280',
  },
  filterActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  clearAllText: {
    fontSize: 13,
    color: '#6B7280',
  },
  filterApplyButtonWrapper: {
    flex: 1,
    marginLeft: 12,
  },
});
