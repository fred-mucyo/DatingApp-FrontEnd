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
import Svg, { Path, Circle } from 'react-native-svg';

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabaseClient';
import { resolveAge } from '../../utils/age';

type ExploreScreenProps = NativeStackScreenProps<RootStackParamList, 'Explore'>;

interface ExploreProfile {
  id: string;
  name: string | null;
  age: number | null;
  date_of_birth?: string | null;
  gender: string | null;
  city: string | null;
  country: string | null;
  photos: string[] | null;
  is_verified: boolean | null;
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

  const SearchIcon = ({ color = '#111827' }: { color?: string }) => (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={2} />
      <Path d="M20 20l-3.5-3.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );

  const LocationIcon = ({ color = '#9CA3AF' }: { color?: string }) => (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22s7-4.35 7-12a7 7 0 1 0-14 0c0 7.65 7 12 7 12Z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={10} r={2} fill={color} />
    </Svg>
  );

  const VerifiedIcon = ({ color = '#ff4b2b' }: { color?: string }) => (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6 9 17l-5-5"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );

  const UserIcon = ({ color = '#9CA3AF' }: { color?: string }) => (
    <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 21a8 8 0 0 0-16 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={2} />
    </Svg>
  );

  const fetchProfilesByName = useCallback(
    async (offset: number): Promise<ExploreProfile[]> => {
      if (!user) return [];
      const name = nameFilter.trim();
      let query = supabase
        .from('profiles')
        .select('id, name, age, date_of_birth, gender, city, country, photos, is_verified')
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
          .select('id, name, age, date_of_birth, gender, city, country, photos, is_verified')
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
    const resolvedAge = resolveAge({ age: item.age, date_of_birth: item.date_of_birth });
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
            <UserIcon />
          </View>
        )}
        <View style={styles.cardOverlay} />
        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name ?? 'Unknown'}
              {resolvedAge ? `, ${resolvedAge}` : ''}
            </Text>
            {item.is_verified ? (
              <View style={styles.verifiedIconWrap}>
                <VerifiedIcon />
              </View>
            ) : null}
          </View>

          {(!!item.city || !!item.country) && (
            <View style={styles.locationRow}>
              <LocationIcon />
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
                  <View style={styles.searchIconInline}>
                    <SearchIcon color="#6B7280" />
                  </View>
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
                    <SearchIcon color="#FFFFFF" />
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
                <ActivityIndicator size="small" color="#ff4b2b" />
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
    backgroundColor: '#1A1A1A',
  },
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  listContent: {
    paddingBottom: 24,
    paddingTop: 6,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    columnGap: 12,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  searchBarContainer: {
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  searchIconInline: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 0,
  },
  searchIconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ff4b2b',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  infoContainer: {
    marginTop: 8,
    padding: 10,
    backgroundColor: 'rgba(255, 75, 43, 0.12)',
    borderRadius: 12,
  },
  info: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  card: {
    flex: 1,
    height: 240,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 6,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 64,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  cardInfo: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  verifiedIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  meta: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  footerContainer: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    paddingHorizontal: 16,
  },
  showMoreButton: {
    width: '100%',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: '#ff4b2b',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff4b2b',
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 5,
  },
  showMoreText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#ff4b2b',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    shadowColor: '#ff4b2b',
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