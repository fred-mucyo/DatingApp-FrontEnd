import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  SafeAreaView,
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
const FETCH_CHUNK_SIZE = 30;

const ExploreScreen: React.FC<ExploreScreenProps> = ({ navigation }) => {
  const { user, profile } = useAuth();

  const [nameFilter, setNameFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<ExploreProfile[]>([]);
  const [info, setInfo] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [fetchOffset, setFetchOffset] = useState(0);

  const baseQuery = () => {
    if (!user) return null;
    let query = supabase
      .from('profiles')
      .select('id, name, age, gender, city, country, photos')
      .eq('is_complete', true)
      .neq('id', user.id)
      .order('created_at', { ascending: false });

    if (nameFilter.trim()) {
      const name = nameFilter.trim();
      query = query.ilike('name', `%${name}%`);
    }

    return query;
  };

  const handleSearch = async (reset = true) => {
    if (!user) return;
    setLoading(true);
    setInfo('');
    try {
      const preferredGender = profile?.gender_preference;

      if (reset) {
        setProfiles([]);
        setFetchOffset(0);
      }

      if (reset && preferredGender && preferredGender !== 'all') {
        const queryPreferred = baseQuery()?.eq('gender', preferredGender);
        const queryOther = baseQuery()?.neq('gender', preferredGender);

        if (!queryPreferred || !queryOther) {
          setHasMore(false);
          return;
        }

        const [{ data: prefData, error: prefErr }, { data: otherData, error: otherErr }] =
          await Promise.all([
            queryPreferred.limit(PAGE_SIZE).range(0, PAGE_SIZE - 1),
            queryOther.limit(PAGE_SIZE).range(0, PAGE_SIZE - 1),
          ]);

        if (prefErr) {
          setInfo(prefErr.message);
          setProfiles([]);
          setHasMore(false);
          return;
        }
        if (otherErr) {
          setInfo(otherErr.message);
          setProfiles([]);
          setHasMore(false);
          return;
        }

        const pref = ((prefData as ExploreProfile[]) ?? []).slice(0, PAGE_SIZE);
        const remainder = PAGE_SIZE - pref.length;

        const otherRaw = (otherData as ExploreProfile[]) ?? [];
        const other = otherRaw.filter((p) => !pref.some((x) => x.id === p.id)).slice(0, remainder);

        const merged = [...pref, ...other];

        setProfiles(merged);
        setHasMore(merged.length === PAGE_SIZE && (pref.length === PAGE_SIZE || otherRaw.length > 0));
        if (merged.length === 0) {
          setInfo('No profiles found.');
        }
        return;
      }

      const query = baseQuery();
      if (!query) {
        setHasMore(false);
        return;
      }

      const rangeStart = reset ? 0 : fetchOffset;
      const rangeEnd = rangeStart + FETCH_CHUNK_SIZE - 1;
      const { data, error } = await query.range(rangeStart, rangeEnd);
      if (error) {
        setInfo(error.message);
        if (reset) setProfiles([]);
        setHasMore(false);
        return;
      }

      const raw = (data as ExploreProfile[]) ?? [];
      const unique = raw.filter((p) => !profiles.some((x) => x.id === p.id));
      const nextBatch = unique.slice(0, PAGE_SIZE);

      const nextProfiles = reset ? nextBatch : [...profiles, ...nextBatch];
      setProfiles(nextProfiles);
      setFetchOffset(rangeStart + raw.length);
      setHasMore(nextBatch.length === PAGE_SIZE && raw.length > 0);

      if (reset && nextProfiles.length === 0) {
        setInfo('No profiles found.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !profile) return;
    handleSearch(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.gender_preference]);

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
          contentContainerStyle={[styles.scrollContent, styles.listContent]}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          ListHeaderComponent={
            <View>
              <View style={styles.searchBarContainer}>
                <View style={styles.searchBar}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name..."
                    placeholderTextColor="#9CA3AF"
                    value={nameFilter}
                    onChangeText={setNameFilter}
                    returnKeyType="search"
                    onSubmitEditing={() => handleSearch(true)}
                  />
                  <TouchableOpacity
                    onPress={() => handleSearch(true)}
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
            <View>
              {loading ? <ActivityIndicator size="small" color="#F97316" /> : null}
              {!loading && hasMore && profiles.length > 0 && (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => handleSearch(false)}
                  style={styles.applyButton}
                >
                  <Text style={styles.applyButtonText}>Show more</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
};

export default ExploreScreen;
//             <View style={styles.backIconCircle}>
//               <Text style={styles.headerBack}>←</Text>
//             </View>
//           </TouchableOpacity>
//           <Text style={styles.headerTitle}>Explore</Text>
//           <TouchableOpacity
//             style={styles.headerButton}
//             onPress={() => setFiltersOpen((prev) => !prev)}
//           >
//             <View style={styles.settingsIconCircle}>
//               <Text style={styles.headerFilterIcon}>⚙️</Text>
//               {activeFilterCount > 0 && (
//                 <View style={styles.headerFilterBadge}>
//                   <Text style={styles.headerFilterBadgeText}>{activeFilterCount}</Text>
//                 </View>
//               )}
//             </View>
//           </TouchableOpacity>
//         </View>

//         <ScrollView contentContainerStyle={styles.scrollContent}>
//           <View style={styles.filterSummaryRow}>
//             <View style={styles.filterChipsRow}>
//               {genderFilter !== 'all' && (
//                 <View style={styles.summaryChip}>
//                   <Text style={styles.summaryChipText}>{genderFilter}</Text>
//                 </View>
//               )}
//               {!!locationFilter.trim() && (
//                 <View style={styles.summaryChip}>
//                   <Text style={styles.summaryChipText}>{locationFilter.trim()}</Text>
//                 </View>
//               )}
//               {(minAge || maxAge) && (
//                 <View style={styles.summaryChip}>
//                   <Text style={styles.summaryChipText}>
//                     Age {minAge || '18'}-{maxAge || '80+'}
//                   </Text>
//                 </View>
//               )}
//               {activeFilterCount === 0 && (
//                 <Text style={styles.summaryPlaceholder}>No filters applied</Text>
//               )}
//             </View>
//             <TouchableOpacity onPress={() => setFiltersOpen((prev) => !prev)}>
//               <Text style={styles.editFiltersText}>{filtersOpen ? 'Hide' : 'Edit'}</Text>
//             </TouchableOpacity>
//           </View>

//           {filtersOpen && (
//             <View style={styles.filterCard}>
//               <View style={styles.filterSection}>
//                 <Text style={styles.filterLabel}>Show me</Text>
//                 <View style={styles.chipRow}>
//                   {(['all', 'male', 'female', 'other'] as const).map((g) => (
//                     <TouchableOpacity
//                       key={g}
//                       style={[styles.chip, genderFilter === g && styles.chipSelected]}
//                       onPress={() => setGenderFilter(g)}
//                       activeOpacity={0.7}
//                     >
//                       <Text style={genderFilter === g ? styles.chipTextSelected : styles.chipText}>
//                         {g.charAt(0).toUpperCase() + g.slice(1)}
//                       </Text>
//                     </TouchableOpacity>
//                   ))}
//                 </View>
//               </View>

//               <View style={styles.filterSection}>
//                 <Text style={styles.filterLabel}>Location</Text>
//                 <TextInput
//                   style={styles.input}
//                   placeholder="City or country..."
//                   placeholderTextColor="#9CA3AF"
//                   value={locationFilter}
//                   onChangeText={setLocationFilter}
//                 />
//                 <Text style={styles.helperText}>Partial matches work too.</Text>
//               </View>

//               <View style={styles.filterSectionRow}>
//                 <View style={styles.filterColumnHalf}>
//                   <Text style={styles.filterLabel}>Min age</Text>
//                   <TextInput
//                     style={styles.input}
//                     keyboardType="number-pad"
//                     placeholder="18"
//                     placeholderTextColor="#9CA3AF"
//                     value={minAge}
//                     onChangeText={setMinAge}
//                   />
//                 </View>
//                 <View style={styles.filterColumnHalfLast}>
//                   <Text style={styles.filterLabel}>Max age</Text>
//                   <TextInput
//                     style={styles.input}
//                     keyboardType="number-pad"
//                     placeholder="80"
//                     placeholderTextColor="#9CA3AF"
//                     value={maxAge}
//                     onChangeText={setMaxAge}
//                   />
//                 </View>
//               </View>

//               <View style={styles.filterActionsRow}>
//                 <TouchableOpacity
//                   onPress={() => {
//                     setGenderFilter('all');
//                     setLocationFilter('');
//                     setMinAge('');
//                     setMaxAge('');
//                   }}
//                   style={styles.clearButton}
//                 >
//                   <Text style={styles.clearAllText}>Clear all</Text>
//                 </TouchableOpacity>
//                 <TouchableOpacity
//                   onPress={handleSearch}
//                   disabled={loading}
//                   style={[styles.applyButton, loading && styles.applyButtonDisabled]}
//                 >
//                   <Text style={styles.applyButtonText}>
//                     {loading ? 'Searching...' : 'Apply filters'}
//                   </Text>
//                 </TouchableOpacity>
//               </View>
//             </View>
//           )}

//           {loading && (
//             <View style={styles.loadingRow}>
//               <ActivityIndicator size="large" color="#EC4899" />
//               <Text style={styles.loadingText}>Finding profiles...</Text>
//             </View>
//           )}

//           {!!info && (
//             <View style={styles.infoContainer}>
//               <Text style={styles.info}>{info}</Text>
//             </View>
//           )}
//..............
          // <FlatList
          //   data={profiles}
          //   keyExtractor={(item) => item.id}
          //   renderItem={renderItem}
          //   contentContainerStyle={styles.listContent}
          //   numColumns={2}
          //   columnWrapperStyle={styles.columnWrapper}
          //   onEndReached={() => {
          //     if (hasMore && !loading) {
          //       setPage((prev) => prev + 1);
          //       handleSearch(false);
          //     }
          //   }}
          //   onEndReachedThreshold={0.5}
          //   scrollEnabled={true}
          //   ListFooterComponent={loading ? <ActivityIndicator size="small" color="#EC4899" /> : null}
          // />
//         </ScrollView>
//       </View>
//     </SafeAreaView>
//   );
// };

// const styles = StyleSheet.create({
//   safeArea: {
//     flex: 1,
//     backgroundColor: '#F9FAFB',
//   },
//   container: {
//     flex: 1,
//   },
//   headerBar: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingHorizontal: 20,
//     paddingVertical: 16,
//     backgroundColor: '#FFFFFF',
//     borderBottomWidth: 1,
//     borderBottomColor: '#F3F4F6',
//     shadowColor: '#000000',
//     shadowOpacity: 0.03,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 4,
//     elevation: 2,
//   },
//   headerButton: {
//     position: 'absolute',
//     padding: 4,
//     zIndex: 10,
//   },
//   backIconCircle: {
//     width: 36,
//     height: 36,
//     borderRadius: 18,
//     backgroundColor: '#F3F4F6',
//     alignItems: 'center',
//     justifyContent: 'center',
//     left: 16,
//   },
//   settingsIconCircle: {
//     width: 36,
//     height: 36,
//     borderRadius: 18,
//     backgroundColor: '#F3F4F6',
//     alignItems: 'center',
//     justifyContent: 'center',
//     right: -310,
//   },
//   headerBack: {
//     fontSize: 20,
//     color: '#111827',
//   },
//   headerTitle: {
//     fontSize: 22,
//     fontWeight: '700',
//     color: '#111827',
//     letterSpacing: -0.5,
//   },
//   headerFilterIcon: {
//     fontSize: 18,
//   },
//   headerFilterBadge: {
//     position: 'absolute',
//     right: -2,
//     top: -2,
//     backgroundColor: '#EC4899',
//     borderRadius: 10,
//     minWidth: 18,
//     height: 18,
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingHorizontal: 4,
//     borderWidth: 2,
//     borderColor: '#FFFFFF',
//   },
//   headerFilterBadgeText: {
//     fontSize: 10,
//     color: '#FFFFFF',
//     fontWeight: '700',
//   },
//   scrollContent: {
//     paddingHorizontal: 16,
//     paddingTop: 16,
//     paddingBottom: 24,
//   },
//   filterSummaryRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 12,
//     minHeight: 32,
//   },
//   filterChipsRow: {
//     flexDirection: 'row',
//     flexWrap: 'wrap',
//     flex: 1,
//     alignItems: 'center',
//   },
//   summaryChip: {
//     paddingHorizontal: 12,
//     paddingVertical: 6,
//     borderRadius: 20,
//     backgroundColor: '#FCE7F3',
//     marginRight: 6,
//     marginBottom: 6,
//     borderWidth: 1,
//     borderColor: '#F9A8D4',
//   },
//   summaryChipText: {
//     fontSize: 13,
//     color: '#DB2777',
//     fontWeight: '500',
//   },
//   summaryPlaceholder: {
//     fontSize: 13,
//     color: '#9CA3AF',
//     fontStyle: 'italic',
//   },
//   editFiltersText: {
//     fontSize: 14,
//     color: '#EC4899',
//     fontWeight: '600',
//     marginLeft: 8,
//   },
//   filterCard: {
//     backgroundColor: '#FFFFFF',
//     borderRadius: 20,
//     padding: 20,
//     marginBottom: 20,
//     shadowColor: '#000000',
//     shadowOpacity: 0.08,
//     shadowOffset: { width: 0, height: 4 },
//     shadowRadius: 12,
//     elevation: 3,
//     borderWidth: 1,
//     borderColor: '#F3F4F6',
//   },
//   filterSection: {
//     marginBottom: 20,
//   },
//   filterSectionRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     marginBottom: 20,
//   },
//   filterColumnHalf: {
//     flex: 1,
//     marginRight: 12,
//   },
//   filterColumnHalfLast: {
//     flex: 1,
//   },
//   filterLabel: {
//     fontSize: 14,
//     fontWeight: '700',
//     marginBottom: 8,
//     color: '#111827',
//     letterSpacing: -0.2,
//   },
//   input: {
//     borderWidth: 1.5,
//     borderColor: '#E5E7EB',
//     borderRadius: 12,
//     paddingHorizontal: 14,
//     paddingVertical: 12,
//     fontSize: 15,
//     color: '#111827',
//     backgroundColor: '#F9FAFB',
//   },
//   helperText: {
//     fontSize: 12,
//     color: '#6B7280',
//     marginTop: 6,
//     fontStyle: 'italic',
//   },
//   chipRow: {
//     flexDirection: 'row',
//     flexWrap: 'wrap',
//   },
//   chip: {
//     borderWidth: 1.5,
//     borderColor: '#E5E7EB',
//     borderRadius: 20,
//     paddingHorizontal: 16,
//     paddingVertical: 8,
//     marginRight: 8,
//     marginBottom: 8,
//     backgroundColor: '#FFFFFF',
//   },
//   chipSelected: {
//     backgroundColor: '#EC4899',
//     borderColor: '#EC4899',
//   },
//   chipText: {
//     color: '#374151',
//     fontSize: 14,
//     fontWeight: '500',
//   },
//   chipTextSelected: {
//     color: '#FFFFFF',
//     fontSize: 14,
//     fontWeight: '600',
//   },
//   loadingRow: {
//     marginVertical: 32,
//     alignItems: 'center',
//   },
//   loadingText: {
//     marginTop: 12,
//     fontSize: 14,
//     color: '#6B7280',
//     fontWeight: '500',
//   },
//   infoContainer: {
//     backgroundColor: '#FEF3C7',
//     borderRadius: 12,
//     padding: 16,
//     marginBottom: 16,
//     borderWidth: 1,
//     borderColor: '#FDE68A',
//   },
//   info: {
//     textAlign: 'center',
//     color: '#92400E',
//     fontSize: 14,
//     fontWeight: '500',
//   },
//   listContent: {
//     paddingTop: 8,
//     paddingBottom: 24,
//   },
//   columnWrapper: {
//     justifyContent: 'space-between',
//   },
//   card: {
//     width: '48%',
//     borderRadius: 20,
//     backgroundColor: '#FFFFFF',
//     marginBottom: 16,
//     overflow: 'hidden',
//     shadowColor: '#000000',
//     shadowOpacity: 0.1,
//     shadowOffset: { width: 0, height: 4 },
//     shadowRadius: 12,
//     elevation: 3,
//     position: 'relative',
//   },
//   photo: {
//     width: '100%',
//     height: 200,
//   },
//   photoPlaceholder: {
//     width: '100%',
//     height: 200,
//     backgroundColor: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   placeholderIcon: {
//     fontSize: 64,
//     opacity: 0.3,
//   },
//   cardGradient: {
//     position: 'absolute',
//     bottom: 0,
//     left: 0,
//     right: 0,
//     height: 100,
//     backgroundColor: 'transparent',
//   },
//   cardInfo: {
//     paddingHorizontal: 12,
//     paddingVertical: 12,
//   },
//   name: {
//     fontSize: 16,
//     fontWeight: '700',
//     marginBottom: 4,
//     color: '#111827',
//     letterSpacing: -0.3,
//   },
//   locationRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   locationIcon: {
//     fontSize: 11,
//     marginRight: 4,
//   },
//   meta: {
//     fontSize: 13,
//     color: '#6B7280',
//     flex: 1,
//   },
//   filterActionsRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     marginTop: 4,
//   },
//   clearButton: {
//     paddingVertical: 12,
//     paddingHorizontal: 16,
//   },
//   clearAllText: {
//     fontSize: 14,
//     color: '#6B7280',
//     fontWeight: '600',
//   },
//   applyButton: {
//     flex: 1,
//     backgroundColor: '#EC4899',
//     borderRadius: 12,
//     paddingVertical: 14,
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginLeft: 8,
//     shadowColor: '#EC4899',
//     shadowOpacity: 0.3,
//     shadowOffset: { width: 0, height: 4 },
//     shadowRadius: 8,
//     elevation: 3,
//   },
//   applyButtonDisabled: {
//     backgroundColor: '#9CA3AF',
//     shadowOpacity: 0,
//   },
//   applyButtonText: {
//     color: '#FFFFFF',
//     fontSize: 15,
//     fontWeight: '700',
//     letterSpacing: -0.2,
//   },
// });

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  headerBackButton: {
    position: 'absolute',
    left: 16,
    padding: 4,
    zIndex: 10,
  },
  headerSettingsButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
    zIndex: 10,
  },
  backIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBack: {
    fontSize: 22,
    color: '#1A1A1A',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  headerFilterIcon: {
    fontSize: 20,
  },
  headerFilterBadge: {
    position: 'absolute',
    right: -2,
    top: -2,
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerFilterBadgeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },
  searchBarContainer: {
    marginBottom: 16,
  },
  searchLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
    color: '#1A1A1A',
    letterSpacing: -0.3,
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
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
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
  filterSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    minHeight: 32,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
    alignItems: 'center',
  },
  summaryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFF5F5',
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  summaryChipText: {
    fontSize: 13,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  summaryPlaceholder: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  editFiltersText: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '600',
    marginLeft: 8,
  },
  filterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  filterColumnHalf: {
    flex: 1,
    marginRight: 12,
  },
  filterColumnHalfLast: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1A1A1A',
    backgroundColor: '#FAFAFA',
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
    fontStyle: 'italic',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginRight: 10,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  chipSelected: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  chipText: {
    color: '#666666',
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingRow: {
    marginVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#666666',
    fontWeight: '500',
  },
  infoContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
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