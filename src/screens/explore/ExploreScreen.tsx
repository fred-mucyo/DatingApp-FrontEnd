import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Image,
} from 'react-native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabaseClient';

type ExploreScreenProps = NativeStackScreenProps<RootStackParamList, 'Explore'>;

interface ExploreProfile {
  id: string;
  name: string | null;
  age: number | null;
  gender: string | null;
  city: string | null;
  country: string | null;
  photos: string[] | null;
}

const PAGE_SIZE = 10;

const ExploreScreen: React.FC<ExploreScreenProps> = ({ navigation }) => {
  const { user, profile } = useAuth();
  const [nameFilter, setNameFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<ExploreProfile[]>([]);
  const [info, setInfo] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [preferredOffset, setPreferredOffset] = useState(0);
  const [otherOffset, setOtherOffset] = useState(0);

  const fetchProfilesByName = useCallback(
    async (offset: number): Promise<ExploreProfile[]> => {
      if (!user) return [];
      const name = nameFilter.trim();
      let query = supabase
        .from('profiles')
        .select('id, name, age, gender, city, country, photos')
        .eq('is_complete', true)
        .neq('id', user.id)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)
        .range(offset, offset + PAGE_SIZE - 1);

      if (name) {
        query = query.ilike('name', `%${name}%`);
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }
      return (data as ExploreProfile[]) ?? [];
    },
    [nameFilter, user],
  );

  const fetchPrioritizedProfiles = useCallback(
    async (prefOffset: number, othOffset: number) => {
      if (!user) {
        return { combined: [] as ExploreProfile[], preferredCount: 0, otherCount: 0 };
      }

      const pref = (profile as any)?.gender_preference as string | null;
      const preferredGender = pref && pref !== 'all' ? pref : null;

      const base = () =>
        supabase
          .from('profiles')
          .select('id, name, age, gender, city, country, photos')
          .eq('is_complete', true)
          .neq('id', user.id)
          .order('created_at', { ascending: false });

      let preferred: ExploreProfile[] = [];
      let others: ExploreProfile[] = [];

      if (preferredGender) {
        const { data: prefData, error: prefError } = await base()
          .eq('gender', preferredGender)
          .limit(PAGE_SIZE)
          .range(prefOffset, prefOffset + PAGE_SIZE - 1);

        if (prefError) throw prefError;
        preferred = (prefData as ExploreProfile[]) ?? [];
      }

      const remaining = PAGE_SIZE - preferred.length;
      if (remaining > 0) {
        let otherQuery = base();
        if (preferredGender) {
          otherQuery = otherQuery.neq('gender', preferredGender);
        }

        const { data: otherData, error: otherError } = await otherQuery
          .limit(remaining)
          .range(othOffset, othOffset + remaining - 1);

        if (otherError) throw otherError;
        others = (otherData as ExploreProfile[]) ?? [];
      }

      const combined = [...preferred, ...others];
      return { combined, preferredCount: preferred.length, otherCount: others.length };
    },
    [profile, user],
  );

  const handleSearch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setInfo('');
    setPage(0);
    setPreferredOffset(0);
    setOtherOffset(0);

    try {
      const data = await fetchProfilesByName(0);
      setProfiles(data);
      setHasMore(data.length === PAGE_SIZE);
      if (data.length === 0) {
        setInfo('No profiles found.');
      }
    } catch (e: any) {
      setInfo(e?.message ?? 'Failed to search profiles.');
      setProfiles([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [fetchProfilesByName, user]);

  const loadDefault = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setInfo('');
    setPage(0);
    setPreferredOffset(0);
    setOtherOffset(0);

    try {
      const { combined, preferredCount, otherCount } = await fetchPrioritizedProfiles(0, 0);
      setProfiles(combined);
      setPreferredOffset(preferredCount);
      setOtherOffset(otherCount);
      setHasMore(combined.length === PAGE_SIZE);
      if (combined.length === 0) {
        setInfo('No profiles found.');
      }
    } catch (e: any) {
      setInfo(e?.message ?? 'Failed to load profiles.');
      setProfiles([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [fetchPrioritizedProfiles, user]);

  const handleShowMore = useCallback(async () => {
    if (!user || loading || !hasMore) return;
    setLoading(true);
    setInfo('');

    try {
      const isSearching = !!nameFilter.trim();
      if (isSearching) {
        const nextPage = page + 1;
        const data = await fetchProfilesByName(nextPage * PAGE_SIZE);
        setProfiles((prev) => [...prev, ...data]);
        setPage(nextPage);
        setHasMore(data.length === PAGE_SIZE);
        return;
      }

      const { combined, preferredCount, otherCount } = await fetchPrioritizedProfiles(
        preferredOffset,
        otherOffset,
      );

      setProfiles((prev) => {
        const existing = new Set(prev.map((p) => p.id));
        const toAdd = combined.filter((p) => !existing.has(p.id));
        return [...prev, ...toAdd];
      });

      setPreferredOffset((prev) => prev + preferredCount);
      setOtherOffset((prev) => prev + otherCount);
      setHasMore(combined.length === PAGE_SIZE);
    } catch (e: any) {
      setInfo(e?.message ?? 'Failed to load more profiles.');
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [fetchPrioritizedProfiles, fetchProfilesByName, hasMore, loading, nameFilter, otherOffset, page, preferredOffset, user]);

  useEffect(() => {
    if (!user) return;
    if (nameFilter.trim()) return;
    loadDefault();
  }, [loadDefault, nameFilter, user?.id]);

  const renderItem = ({ item }: { item: ExploreProfile }) => {
    const mainPhoto = item.photos && item.photos[0];
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ViewUserProfile', { userId: item.id })}
        activeOpacity={0.8}
      >
        {mainPhoto ? (
          <Image source={{ uri: mainPhoto }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.placeholderIcon}>👤</Text>
          </View>
        )}
        <View style={styles.cardOverlay} />
        <View style={styles.cardInfo}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name ?? 'Unknown'}
            {item.age ? `, ${item.age}` : ''}
          </Text>
          {(!!item.city || !!item.country) && (
            <View style={styles.locationRow}>
              <Text style={styles.locationIcon}>📍</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {[item.city, item.country].filter(Boolean).join(', ')}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <FlatList
          data={profiles}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          ListHeaderComponent={
            <View style={styles.scrollContent}>
              <View style={styles.searchBarContainer}>
                <View style={styles.searchBar}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name..."
                    placeholderTextColor="#9CA3AF"
                    value={nameFilter}
                    onChangeText={setNameFilter}
                    returnKeyType="search"
                    onSubmitEditing={handleSearch}
                  />
                  <TouchableOpacity
                    onPress={handleSearch}
                    activeOpacity={0.8}
                    style={styles.searchIconButton}
                  >
                    <Text style={styles.searchIcon}>🔍</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {!!info && (
                <View style={styles.infoContainer}>
                  <Text style={styles.info}>{info}</Text>
                </View>
              )}
            </View>
          }
          ListFooterComponent={
            <View style={styles.footerContainer}>
              {loading ? (
                <ActivityIndicator size="small" color="#F97316" />
              ) : hasMore && profiles.length > 0 ? (
                <TouchableOpacity
                  onPress={handleShowMore}
                  style={styles.showMoreButton}
                  activeOpacity={0.8}
                >
                  <Text style={styles.showMoreText}>Show more</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
};

export default ExploreScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  searchBarContainer: {
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 4,
  },
  searchIconButton: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 999,
  },
  searchIcon: {
    fontSize: 20,
  },
  infoContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 18,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  info: {
    textAlign: 'center',
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  footerContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showMoreButton: {
    marginTop: 8,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#111827',
  },
  showMoreText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  photo: {
    width: '100%',
    height: 200,
  },
  photoPlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 64,
    opacity: 0.4,
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  cardInfo: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    color: '#FFFFFF',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    fontSize: 11,
    marginRight: 4,
  },
  meta: {
    fontSize: 13,
    color: '#FFFFFF',
    flex: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  filterActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  clearButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  clearAllText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#F97316',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    shadowColor: '#F97316',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  applyButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});