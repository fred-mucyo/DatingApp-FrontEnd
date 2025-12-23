// import React, { useCallback, useEffect, useMemo, useState } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   TextInput,
//   FlatList,
//   TouchableOpacity,
//   ActivityIndicator,
//   Image,
//   Alert,
//   SafeAreaView,
//   ScrollView,
//   Button,
// } from 'react-native';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { NativeStackScreenProps } from '@react-navigation/native-stack';
// import { useAuth } from '../../context/AuthContext';
// import { supabase } from '../../config/supabaseClient';
// import { RootStackParamList } from '../../navigation/RootNavigator';
// import { getDailySuggestions, SuggestionProfile, sendLike } from '../../services/matching';

// type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

// export const HomeScreen: React.FC<Props> = ({ navigation }) => {
//   const { signOut, user, profile } = useAuth();

//   // Daily suggestions / matching state
//   const LIKE_LIMIT_KEY = 'matching.likes_today';
//   const LIKE_LIMIT = 50;

//   const [loadingSuggestions, setLoadingSuggestions] = useState(true);
//   const [suggestions, setSuggestions] = useState<SuggestionProfile[]>([]);
//   const [suggestionIndex, setSuggestionIndex] = useState(0);
//   const [liking, setLiking] = useState(false);
//   const [likesToday, setLikesToday] = useState<{ date: string; count: number } | null>(null);

//   const [searchQuery, setSearchQuery] = useState('');
//   const [searchLoading, setSearchLoading] = useState(false);
//   const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string; name: string | null }>>([]);
//   const [searchInfo, setSearchInfo] = useState('');

//   const greetingName = profile?.name || user?.email || 'there';

//   const { greetingLine, greetingSubtext } = useMemo(() => {
//     const now = new Date();
//     const hours = now.getHours();
//     let sub = 'Ready to discover new connections?';
//     if (hours >= 5 && hours < 12) {
//       sub = 'Ready to start your day right?';
//     } else if (hours >= 12 && hours < 17) {
//       sub = 'Ready to discover new connections?';
//     } else {
//       sub = 'Ready to meet someone special?';
//     }

//     const weekday = now.toLocaleDateString(undefined, { weekday: 'long' });
//     const month = now.toLocaleDateString(undefined, { month: 'long' });
//     const day = now.getDate();
//     const dateString = `${weekday}, ${month} ${day}`;

//     return {
//       greetingLine: `Hi, ${greetingName}!`,
//       greetingSubtext: `${sub}  ·  ${dateString}`,
//     };
//   }, [greetingName]);

//   const loadLikesToday = useCallback(async () => {
//     const today = new Date().toISOString().substring(0, 10);
//     const raw = await AsyncStorage.getItem(LIKE_LIMIT_KEY);
//     if (raw) {
//       try {
//         const parsed: { date: string; count: number } = JSON.parse(raw);
//         if (parsed.date === today) {
//           setLikesToday(parsed);
//           return;
//         }
//       } catch {
//         // ignore parse errors
//       }
//     }
//     const fresh = { date: today, count: 0 };
//     setLikesToday(fresh);
//     await AsyncStorage.setItem(LIKE_LIMIT_KEY, JSON.stringify(fresh));
//   }, []);

//   const incrementLikesToday = useCallback(async () => {
//     const today = new Date().toISOString().substring(0, 10);
//     const next = {
//       date: today,
//       count: (likesToday?.count ?? 0) + 1,
//     };
//     setLikesToday(next);
//     await AsyncStorage.setItem(LIKE_LIMIT_KEY, JSON.stringify(next));
//   }, [likesToday]);

//   const loadSuggestions = useCallback(async () => {
//     setLoadingSuggestions(true);
//     try {
//       // 5 at a time on the client, 15–20 total suggestions per day from the backend
//       const data = await getDailySuggestions(5, 20);
//       setSuggestions(data);
//       setSuggestionIndex(0);
//     } catch (e: any) {
//       Alert.alert('Error', e?.message ?? 'Failed to load suggestions');
//     } finally {
//       setLoadingSuggestions(false);
//     }
//   }, []);

//   useEffect(() => {
//     loadLikesToday();
//     loadSuggestions();
//   }, [loadLikesToday, loadSuggestions]);

//   const visibleSuggestions = suggestions.slice(suggestionIndex, suggestionIndex + 5);

//   const handlePass = () => {
//     if (suggestionIndex + 1 >= suggestions.length) {
//       Alert.alert('End of feed', 'Come back tomorrow for new suggestions.');
//     } else {
//       setSuggestionIndex((prev) => prev + 1);
//     }
//   };

//   const handleLike = async (profileToLike: SuggestionProfile) => {
//     if (!user) return;
//     const todayCount = likesToday?.count ?? 0;
//     if (todayCount >= LIKE_LIMIT) {
//       Alert.alert('Limit reached', 'You have reached your daily like limit.');
//       return;
//     }

//     setLiking(true);
//     try {
//       const { isMatch } = await sendLike(profileToLike.id);
//       await incrementLikesToday();

//       if (isMatch) {
//         Alert.alert("It's a match!", `You and ${profileToLike.name} like each other.`);
//       }
//       handlePass();
//     } catch (e: any) {
//       Alert.alert('Error', e?.message ?? 'Failed to send like');
//     } finally {
//       setLiking(false);
//     }
//   };

//   const renderSuggestionItem = ({ item }: { item: SuggestionProfile }) => {
//     const photo = item.profile_photos?.[0] || (item as any).photos?.[0];

//     return (
//       <View style={styles.card}>
//         {photo ? <Image source={{ uri: photo }} style={styles.photo} /> : null}
//         <Text style={styles.name}>
//           {item.name}, {item.age}
//         </Text>
//         <Text style={styles.meta}>
//           {item.city}, {item.country}
//         </Text>
//         <View style={styles.buttonRowSuggestions}>
//           <Button title="Pass" onPress={handlePass} />
//           <Button
//             title={liking ? 'Liking...' : 'Like'}
//             onPress={() => handleLike(item)}
//             disabled={liking}
//           />
//         </View>
//       </View>
//     );
//   };

//   const handleSearch = async () => {
//     const q = searchQuery.trim();
//     if (!q) {
//       setSearchResults([]);
//       setSearchInfo('');
//       return;
//     }

//     setSearchLoading(true);
//     setSearchInfo('');
//     try {
//       const { data, error } = await supabase
//         .from('profiles')
//         .select('id, username, name')
//         .ilike('username', `${q}%`)
//         .limit(20);

//       if (error) {
//         setSearchInfo(error.message);
//         return;
//       }

//       setSearchResults((data as any) ?? []);
//       if (!data || data.length === 0) {
//         setSearchInfo('No users found with that username.');
//       }
//     } finally {
//       setSearchLoading(false);
//     }
//   };

//   return (
//     <SafeAreaView style={styles.safeArea}>
//       <View style={styles.container}>
//         <View style={styles.headerBar}>
//           <View style={styles.headerLeft}>
//             <View style={styles.logoCircle}>
//               <Text style={styles.logoText}>s</Text>
//             </View>
//             <View>
//               <Text style={styles.headerAppName}>shuu</Text>
//               <Text style={styles.headerBeta}>BETA</Text>
//             </View>
//           </View>
//           <TouchableOpacity style={styles.headerIconButton}>
//             <Text style={styles.headerBell}>🔔</Text>
//             <View style={styles.headerBadge} />
//           </TouchableOpacity>
//         </View>

//         <ScrollView
//           contentContainerStyle={styles.scrollContent}
//           showsVerticalScrollIndicator={false}
//         >
//           <View style={styles.welcomeSection}>
//             <Text style={styles.welcomeTitle}>{greetingLine}</Text>
//             <Text style={styles.welcomeSubtitle}>{greetingSubtext}</Text>
//           </View>

//           <View style={styles.suggestionsSection}>
//             <View style={styles.sectionHeaderRow}>
//               <View>
//                 <Text style={styles.suggestionsHeader}>✨ Today&apos;s picks for you</Text>
//                 <Text style={styles.subheaderSuggestions}>Fresh matches every day</Text>
//               </View>
//               {!!suggestions.length && (
//                 <View style={styles.countBadge}>
//                   <Text style={styles.countBadgeText}>{visibleSuggestions.length} showing</Text>
//                 </View>
//               )}
//             </View>

//             {likesToday && LIKE_LIMIT - likesToday.count <= 5 && suggestions.length > 0 && (
//               <View style={styles.limitBanner}>
//                 <Text style={styles.limitBannerText}>
//                   ⚠️ {LIKE_LIMIT - likesToday.count} likes remaining today
//                 </Text>
//               </View>
//             )}

//             {loadingSuggestions ? (
//               <View style={styles.suggestionsLoadingRow}>
//                 <ActivityIndicator />
//               </View>
//             ) : suggestions.length === 0 ? (
//               <View style={styles.emptyState}>
//                 <Text style={styles.emptyIcon}>📭</Text>
//                 <Text style={styles.emptyTitle}>You&apos;ve seen all your picks for today!</Text>
//                 <Text style={styles.emptySubtitle}>Come back tomorrow for fresh matches.</Text>
//                 <TouchableOpacity
//                   style={styles.secondaryButton}
//                   onPress={() => navigation.navigate('Explore')}
//                 >
//                   <Text style={styles.secondaryButtonText}>Explore more profiles</Text>
//                 </TouchableOpacity>
//               </View>
//             ) : (
//               <FlatList
//                 data={visibleSuggestions}
//                 keyExtractor={(item) => item.id}
//                 renderItem={renderSuggestionItem}
//                 contentContainerStyle={styles.listContent}
//                 showsVerticalScrollIndicator={false}
//               />
//             )}
//           </View>

//           <View style={styles.quickActionsSection}>
//             <View style={styles.sectionHeaderRow}>
//               <Text style={styles.sectionTitle}>Quick actions</Text>
//             </View>
//             <View style={styles.quickGrid}>
//               <TouchableOpacity
//                 style={[styles.quickCard, styles.quickCardExplore]}
//                 onPress={() => navigation.navigate('Explore')}
//               >
//                 <Text style={styles.quickIcon}>🔍</Text>
//                 <View>
//                   <Text style={styles.quickTitle}>Explore</Text>
//                   <Text style={styles.quickSubtitle}>Browse all profiles</Text>
//                 </View>
//               </TouchableOpacity>

//               <TouchableOpacity
//                 style={[styles.quickCard, styles.quickCardMessages]}
//                 onPress={() => navigation.navigate('Matches')}
//               >
//                 <Text style={styles.quickIcon}>💬</Text>
//                 <View>
//                   <Text style={styles.quickTitle}>Messages</Text>
//                   <Text style={styles.quickSubtitle}>Your matches</Text>
//                 </View>
//               </TouchableOpacity>

//               <TouchableOpacity
//                 style={[styles.quickCard, styles.quickCardProfile]}
//                 onPress={() => navigation.navigate('MyProfile')}
//               >
//                 <Text style={styles.quickIcon}>👤</Text>
//                 <View>
//                   <Text style={styles.quickTitle}>My profile</Text>
//                   <Text style={styles.quickSubtitle}>Edit & view</Text>
//                 </View>
//               </TouchableOpacity>

//               <TouchableOpacity
//                 style={[styles.quickCard, styles.quickCardSignOut]}
//                 onPress={signOut}
//               >
//                 <Text style={styles.quickIcon}>🚪</Text>
//                 <View>
//                   <Text style={styles.quickTitle}>Sign out</Text>
//                   <Text style={styles.quickSubtitle}>Leave shuu</Text>
//                 </View>
//               </TouchableOpacity>
//             </View>
//           </View>

//           <View style={styles.searchSection}>
//             <View style={styles.sectionHeaderRow}>
//               <Text style={styles.sectionTitle}>🔍 Find someone specific</Text>
//             </View>
//             <View style={styles.searchBarRow}>
//               <Text style={styles.searchIcon}>🔎</Text>
//               <TextInput
//                 style={styles.searchInput}
//                 placeholder="Search by username..."
//                 placeholderTextColor="#9CA3AF"
//                 autoCapitalize="none"
//                 value={searchQuery}
//                 onChangeText={setSearchQuery}
//                 onSubmitEditing={handleSearch}
//               />
//               {searchQuery.length > 0 && (
//                 <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClearButton}>
//                   <Text style={styles.searchClearText}>✕</Text>
//                 </TouchableOpacity>
//               )}
//             </View>
//             {searchLoading && (
//               <View style={styles.searchLoadingRow}>
//                 <ActivityIndicator size="small" />
//               </View>
//             )}
//             {!!searchInfo && <Text style={styles.searchInfo}>{searchInfo}</Text>}

//             <FlatList
//               data={searchResults}
//               keyExtractor={(item) => item.id}
//               renderItem={({ item }) => (
//                 <TouchableOpacity
//                   style={styles.searchResultRow}
//                   onPress={() => navigation.navigate('ViewUserProfile', { userId: item.id })}
//                 >
//                   <View style={styles.searchAvatarPlaceholder}>
//                     <Text style={styles.searchAvatarInitial}>{item.name?.[0] || item.username[0]}</Text>
//                   </View>
//                   <View style={styles.searchTextColumn}>
//                     <Text style={styles.searchResultName}>{item.name || 'Unknown'}</Text>
//                     <Text style={styles.searchResultUsername}>@{item.username}</Text>
//                   </View>
//                 </TouchableOpacity>
//               )}
//               ListEmptyComponent={null}
//             />
//           </View>
//         </ScrollView>
//       </View>
//     </SafeAreaView>
//   );
// };

// const styles = StyleSheet.create({
//   safeArea: {
//     flex: 1,
//     backgroundColor: '#F8F9FA',
//   },
//   container: {
//     flex: 1,
//   },
//   headerBar: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     paddingHorizontal: 16,
//     paddingTop: 8,
//     paddingBottom: 12,
//     backgroundColor: '#FFFFFF',
//     shadowColor: '#000000',
//     shadowOpacity: 0.06,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 8,
//     elevation: 2,
//   },
//   headerLeft: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   logoCircle: {
//     width: 32,
//     height: 32,
//     borderRadius: 16,
//     backgroundColor: '#FFEDD5',
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginRight: 8,
//   },
//   logoText: {
//     fontSize: 18,
//     fontWeight: '700',
//     color: '#F97316',
//   },
//   headerAppName: {
//     fontSize: 18,
//     fontWeight: '700',
//     color: '#111827',
//   },
//   headerBeta: {
//     fontSize: 11,
//     color: '#EF4444',
//   },
//   headerIconButton: {
//     padding: 8,
//   },
//   headerBell: {
//     fontSize: 18,
//   },
//   headerBadge: {
//     position: 'absolute',
//     right: 6,
//     top: 6,
//     width: 8,
//     height: 8,
//     borderRadius: 4,
//     backgroundColor: '#EF4444',
//   },
//   scrollContent: {
//     paddingHorizontal: 16,
//     paddingTop: 16,
//     paddingBottom: 24,
//   },
//   welcomeSection: {
//     marginBottom: 24,
//   },
//   welcomeTitle: {
//     fontSize: 20,
//     fontWeight: '600',
//     color: '#111827',
//     marginBottom: 4,
//   },
//   welcomeSubtitle: {
//     fontSize: 13,
//     color: '#6B7280',
//   },
//   suggestionsSection: {
//     marginBottom: 24,
//   },
//   sectionHeaderRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     marginBottom: 8,
//   },
//   suggestionsHeader: {
//     fontSize: 18,
//     fontWeight: '600',
//     color: '#111827',
//   },
//   subheaderSuggestions: {
//     fontSize: 12,
//     color: '#6B7280',
//   },
//   countBadge: {
//     paddingHorizontal: 10,
//     paddingVertical: 4,
//     borderRadius: 999,
//     backgroundColor: '#F97316',
//   },
//   countBadgeText: {
//     fontSize: 11,
//     color: '#FFFFFF',
//     fontWeight: '500',
//   },
//   limitBanner: {
//     marginTop: 8,
//     marginBottom: 8,
//     paddingVertical: 6,
//     paddingHorizontal: 10,
//     borderRadius: 999,
//     backgroundColor: '#FEF3C7',
//   },
//   limitBannerText: {
//     fontSize: 12,
//     color: '#92400E',
//   },
//   suggestionsLoadingRow: {
//     paddingVertical: 16,
//     alignItems: 'center',
//   },
//   listContent: {
//     paddingBottom: 8,
//   },
//   card: {
//     borderRadius: 20,
//     backgroundColor: '#FFFFFF',
//     marginBottom: 16,
//     shadowColor: '#000000',
//     shadowOpacity: 0.06,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 8,
//     elevation: 2,
//     overflow: 'hidden',
//   },
//   photo: {
//     width: '100%',
//     height: 260,
//   },
//   name: {
//     fontSize: 18,
//     fontWeight: '600',
//     marginBottom: 2,
//     color: '#111827',
//   },
//   meta: {
//     fontSize: 13,
//     color: '#6B7280',
//   },
//   buttonRowSuggestions: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     marginTop: 12,
//     paddingHorizontal: 12,
//     paddingBottom: 12,
//   },
//   quickActionsSection: {
//     marginBottom: 24,
//   },
//   sectionTitle: {
//     fontSize: 16,
//     fontWeight: '600',
//     color: '#111827',
//   },
//   quickGrid: {
//     marginTop: 12,
//     flexDirection: 'row',
//     flexWrap: 'wrap',
//     justifyContent: 'space-between',
//   },
//   quickCard: {
//     width: '48%',
//     height: 100,
//     borderRadius: 16,
//     backgroundColor: '#FFFFFF',
//     padding: 12,
//     marginBottom: 12,
//     flexDirection: 'row',
//     alignItems: 'center',
//     shadowColor: '#000000',
//     shadowOpacity: 0.06,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 8,
//     elevation: 1,
//   },
//   quickCardExplore: {
//     borderLeftWidth: 4,
//     borderLeftColor: '#F97316',
//   },
//   quickCardMessages: {
//     borderLeftWidth: 4,
//     borderLeftColor: '#6366F1',
//   },
//   quickCardProfile: {
//     borderLeftWidth: 4,
//     borderLeftColor: '#3B82F6',
//   },
//   quickCardSignOut: {
//     borderLeftWidth: 4,
//     borderLeftColor: '#EF4444',
//   },
//   quickIcon: {
//     fontSize: 28,
//     marginRight: 8,
//   },
//   quickTitle: {
//     fontSize: 15,
//     fontWeight: '600',
//     color: '#111827',
//   },
//   quickSubtitle: {
//     fontSize: 12,
//     color: '#6B7280',
//   },
//   searchSection: {
//     marginBottom: 16,
//   },
//   searchBarRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     borderRadius: 24,
//     backgroundColor: '#FFFFFF',
//     paddingHorizontal: 12,
//     height: 48,
//     borderWidth: 1,
//     borderColor: '#E5E7EB',
//   },
//   searchIcon: {
//     fontSize: 18,
//     marginRight: 6,
//   },
//   searchInput: {
//     flex: 1,
//     fontSize: 14,
//     color: '#111827',
//   },
//   searchLoadingRow: {
//     marginTop: 8,
//     alignItems: 'center',
//   },
//   searchInfo: {
//     marginTop: 8,
//     textAlign: 'center',
//     color: '#555',
//   },
//   searchResultRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginTop: 12,
//     paddingVertical: 8,
//     paddingHorizontal: 12,
//     borderRadius: 12,
//     backgroundColor: '#FFFFFF',
//     shadowColor: '#000000',
//     shadowOpacity: 0.03,
//     shadowOffset: { width: 0, height: 1 },
//     shadowRadius: 4,
//     elevation: 1,
//   },
//   searchAvatarPlaceholder: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: '#E5E7EB',
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginRight: 12,
//   },
//   searchAvatarInitial: {
//     fontSize: 16,
//     fontWeight: '600',
//     color: '#4B5563',
//   },
//   searchTextColumn: {
//     flex: 1,
//   },
//   searchResultUsername: {
//     fontSize: 13,
//     color: '#6B7280',
//   },
//   searchResultName: {
//     fontSize: 15,
//     fontWeight: '600',
//     color: '#111827',
//   },
//   searchClearButton: {
//     paddingHorizontal: 4,
//     paddingVertical: 4,
//   },
//   searchClearText: {
//     fontSize: 16,
//     color: '#9CA3AF',
//   },
//   emptyState: {
//     alignItems: 'center',
//     paddingVertical: 24,
//   },
//   emptyIcon: {
//     fontSize: 40,
//     marginBottom: 8,
//   },
//   emptyTitle: {
//     fontSize: 18,
//     fontWeight: '600',
//     color: '#111827',
//     marginBottom: 4,
//     textAlign: 'center',
//   },
//   emptySubtitle: {
//     fontSize: 14,
//     color: '#6B7280',
//     marginBottom: 16,
//     textAlign: 'center',
//   },
//   secondaryButton: {
//     paddingHorizontal: 16,
//     paddingVertical: 10,
//     borderRadius: 999,
//     borderWidth: 1,
//     borderColor: '#F97316',
//   },
//   secondaryButtonText: {
//     fontSize: 14,
//     color: '#F97316',
//     fontWeight: '600',
//   },
// });





// import React, { useCallback, useEffect, useMemo, useState } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   FlatList,
//   TouchableOpacity,
//   ActivityIndicator,
//   Image,
//   Alert,
//   SafeAreaView,
//   ScrollView,
//   Share,
//   Dimensions,
// } from 'react-native';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { NativeStackScreenProps } from '@react-navigation/native-stack';
// import { useAuth } from '../../context/AuthContext';
// import { RootStackParamList } from '../../navigation/RootNavigator';
// import { getDailySuggestions, SuggestionProfile, sendLike } from '../../services/matching';

// type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

// const { width } = Dimensions.get('window');
// const CARD_WIDTH = width - 32;

// export const HomeScreen: React.FC<Props> = ({ navigation }) => {
//   const { user, profile } = useAuth();

//   const LIKE_LIMIT_KEY = 'matching.likes_today';
//   const LIKE_LIMIT = 50;

//   const [loadingSuggestions, setLoadingSuggestions] = useState(true);
//   const [suggestions, setSuggestions] = useState<SuggestionProfile[]>([]);
//   const [suggestionIndex, setSuggestionIndex] = useState(0);
//   const [liking, setLiking] = useState(false);
//   const [likesToday, setLikesToday] = useState<{ date: string; count: number } | null>(null);

//   const greetingName = profile?.name || user?.email || 'there';

//   const { greetingLine, greetingSubtext } = useMemo(() => {
//     const now = new Date();
//     const hours = now.getHours();
//     let sub = 'Ready to discover new connections?';
//     if (hours >= 5 && hours < 12) {
//       sub = 'Ready to start your day right?';
//     } else if (hours >= 12 && hours < 17) {
//       sub = 'Ready to discover new connections?';
//     } else {
//       sub = 'Ready to meet someone special?';
//     }

//     const weekday = now.toLocaleDateString(undefined, { weekday: 'long' });
//     const month = now.toLocaleDateString(undefined, { month: 'long' });
//     const day = now.getDate();
//     const dateString = `${weekday}, ${month} ${day}`;

//     return {
//       greetingLine: `Hi, ${greetingName}!`,
//       greetingSubtext: `${sub}  ·  ${dateString}`,
//     };
//   }, [greetingName]);

//   const loadLikesToday = useCallback(async () => {
//     const today = new Date().toISOString().substring(0, 10);
//     const raw = await AsyncStorage.getItem(LIKE_LIMIT_KEY);
//     if (raw) {
//       try {
//         const parsed: { date: string; count: number } = JSON.parse(raw);
//         if (parsed.date === today) {
//           setLikesToday(parsed);
//           return;
//         }
//       } catch {
//         // ignore parse errors
//       }
//     }
//     const fresh = { date: today, count: 0 };
//     setLikesToday(fresh);
//     await AsyncStorage.setItem(LIKE_LIMIT_KEY, JSON.stringify(fresh));
//   }, []);

//   const incrementLikesToday = useCallback(async () => {
//     const today = new Date().toISOString().substring(0, 10);
//     const next = {
//       date: today,
//       count: (likesToday?.count ?? 0) + 1,
//     };
//     setLikesToday(next);
//     await AsyncStorage.setItem(LIKE_LIMIT_KEY, JSON.stringify(next));
//   }, [likesToday]);

//   const loadSuggestions = useCallback(async () => {
//     setLoadingSuggestions(true);
//     try {
//       const data = await getDailySuggestions(5, 20);
//       setSuggestions(data);
//       setSuggestionIndex(0);
//     } catch (e: any) {
//       Alert.alert('Error', e?.message ?? 'Failed to load suggestions');
//     } finally {
//       setLoadingSuggestions(false);
//     }
//   }, []);

//   useEffect(() => {
//     loadLikesToday();
//     loadSuggestions();
//   }, [loadLikesToday, loadSuggestions]);

//   const visibleSuggestions = suggestions.slice(suggestionIndex, suggestionIndex + 5);

//   const handlePass = () => {
//     if (suggestionIndex + 1 >= suggestions.length) {
//       Alert.alert('End of feed', 'Come back tomorrow for new suggestions.');
//     } else {
//       setSuggestionIndex((prev) => prev + 1);
//     }
//   };

//   const handleLike = async (profileToLike: SuggestionProfile) => {
//     if (!user) return;
//     const todayCount = likesToday?.count ?? 0;
//     if (todayCount >= LIKE_LIMIT) {
//       Alert.alert('Limit reached', 'You have reached your daily like limit.');
//       return;
//     }

//     setLiking(true);
//     try {
//       const { isMatch } = await sendLike(profileToLike.id);
//       await incrementLikesToday();

//       if (isMatch) {
//         Alert.alert("It's a match!", `You and ${profileToLike.name} like each other.`);
//       }
//       handlePass();
//     } catch (e: any) {
//       Alert.alert('Error', e?.message ?? 'Failed to send like');
//     } finally {
//       setLiking(false);
//     }
//   };

//   const handleShare = async () => {
//     try {
//       await Share.share({
//         message: 'Check out this amazing dating app! Download now and find your match.',
//         title: 'Share App',
//       });
//     } catch (error) {
//       console.log('Error sharing:', error);
//     }
//   };

//   const renderSuggestionItem = ({ item }: { item: SuggestionProfile }) => {
//     const photo = item.profile_photos?.[0] || (item as any).photos?.[0];

//     return (
//       <View style={styles.card}>
//         {photo ? (
//           <Image source={{ uri: photo }} style={styles.cardImage} />
//         ) : (
//           <View style={[styles.cardImage, styles.placeholderImage]}>
//             <Text style={styles.placeholderText}>No Photo</Text>
//           </View>
//         )}
        
//         <View style={styles.cardOverlay}>
//           <View style={styles.cardInfo}>
//             <Text style={styles.cardName}>
//               {item.name}, {item.age}
//             </Text>
//             <View style={styles.locationRow}>
//               <Text style={styles.locationIcon}>📍</Text>
//               <Text style={styles.cardLocation}>
//                 {item.city}, {item.country}
//               </Text>
//             </View>
//           </View>
//         </View>

//         <View style={styles.actionButtons}>
//           <TouchableOpacity
//             style={[styles.actionButton, styles.passButton]}
//             onPress={handlePass}
//             disabled={liking}
//           >
//             <Text style={styles.actionIcon}>✕</Text>
//           </TouchableOpacity>

//           <TouchableOpacity
//             style={[styles.actionButton, styles.likeButton]}
//             onPress={() => handleLike(item)}
//             disabled={liking}
//           >
//             {liking ? (
//               <ActivityIndicator color="#FFF" size="small" />
//             ) : (
//               <Text style={styles.actionIcon}>❤️</Text>
//             )}
//           </TouchableOpacity>
//         </View>
//       </View>
//     );
//   };

//   return (
//     <SafeAreaView style={styles.safeArea}>
//       <View style={styles.container}>
//         {/* Top Header */}
//         <View style={styles.topBar}>
//           <Text style={styles.appLogo}>🔥</Text>
//           <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
//             <Text style={styles.shareIcon}>📤</Text>
//           </TouchableOpacity>
//         </View>

//         <ScrollView
//           contentContainerStyle={styles.scrollContent}
//           showsVerticalScrollIndicator={false}
//         >
//           {/* Welcome Section */}
//           <View style={styles.welcomeSection}>
//             <Text style={styles.welcomeTitle}>{greetingLine}</Text>
//             <Text style={styles.welcomeSubtitle}>{greetingSubtext}</Text>
//           </View>

//           {/* Likes Counter */}
//           {likesToday && LIKE_LIMIT - likesToday.count <= 10 && suggestions.length > 0 && (
//             <View style={styles.likesCounter}>
//               <Text style={styles.likesCounterText}>
//                 💛 {LIKE_LIMIT - likesToday.count} likes left today
//               </Text>
//             </View>
//           )}

//           {/* Suggestions */}
//           {loadingSuggestions ? (
//             <View style={styles.loadingContainer}>
//               <ActivityIndicator size="large" color="#FF6B6B" />
//               <Text style={styles.loadingText}>Finding matches for you...</Text>
//             </View>
//           ) : suggestions.length === 0 ? (
//             <View style={styles.emptyState}>
//               <Text style={styles.emptyIcon}>😊</Text>
//               <Text style={styles.emptyTitle}>You've seen everyone for today!</Text>
//               <Text style={styles.emptySubtitle}>
//                 Come back tomorrow for fresh matches
//               </Text>
//               <TouchableOpacity
//                 style={styles.exploreButton}
//                 onPress={() => navigation.navigate('Explore')}
//               >
//                 <Text style={styles.exploreButtonText}>Explore More</Text>
//               </TouchableOpacity>
//             </View>
//           ) : (
//             <FlatList
//               data={visibleSuggestions}
//               keyExtractor={(item) => item.id}
//               renderItem={renderSuggestionItem}
//               contentContainerStyle={styles.listContent}
//               showsVerticalScrollIndicator={false}
//               scrollEnabled={false}
//             />
//           )}
//         </ScrollView>

//         {/* Bottom Navigation Bar */}
//         <View style={styles.bottomNav}>
//           <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
//             <View style={styles.navIconActive}>
//               <Text style={styles.navIconText}>🔥</Text>
//             </View>
//             <Text style={[styles.navLabel, styles.navLabelActive]}>Home</Text>
//           </TouchableOpacity>

//           <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Explore')}>
//             <View style={styles.navIcon}>
//               <Text style={styles.navIconText}>🧭</Text>
//             </View>
//             <Text style={styles.navLabel}>Explore</Text>
//           </TouchableOpacity>

//           <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Matches')}>
//             <View style={styles.navIcon}>
//               <Text style={styles.navIconText}>💬</Text>
//             </View>
//             <Text style={styles.navLabel}>Messages</Text>
//           </TouchableOpacity>

//           <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('MyProfile')}>
//             <View style={styles.navIcon}>
//               <Text style={styles.navIconText}>👤</Text>
//             </View>
//             <Text style={styles.navLabel}>Profile</Text>
//           </TouchableOpacity>
//         </View>
//       </View>
//     </SafeAreaView>
//   );
// };

// const styles = StyleSheet.create({
//   safeArea: {
//     flex: 1,
//     backgroundColor: '#FFFFFF',
//   },
//   container: {
//     flex: 1,
//     backgroundColor: '#FAFAFA',
//   },
//   topBar: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     paddingHorizontal: 20,
//     paddingVertical: 12,
//     backgroundColor: '#FFFFFF',
//     borderBottomWidth: 1,
//     borderBottomColor: '#F0F0F0',
//   },
//   appLogo: {
//     fontSize: 32,
//   },
//   shareButton: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: '#F8F8F8',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   shareIcon: {
//     fontSize: 18,
//   },
//   scrollContent: {
//     paddingBottom: 100,
//   },
//   welcomeSection: {
//     paddingHorizontal: 20,
//     paddingTop: 20,
//     paddingBottom: 16,
//   },
//   welcomeTitle: {
//     fontSize: 28,
//     fontWeight: '700',
//     color: '#1A1A1A',
//     marginBottom: 4,
//   },
//   welcomeSubtitle: {
//     fontSize: 14,
//     color: '#666666',
//   },
//   likesCounter: {
//     marginHorizontal: 20,
//     marginBottom: 16,
//     paddingVertical: 10,
//     paddingHorizontal: 16,
//     borderRadius: 12,
//     backgroundColor: '#FFF9E6',
//     borderWidth: 1,
//     borderColor: '#FFE066',
//   },
//   likesCounterText: {
//     fontSize: 13,
//     color: '#B8860B',
//     fontWeight: '600',
//     textAlign: 'center',
//   },
//   loadingContainer: {
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: 60,
//   },
//   loadingText: {
//     marginTop: 12,
//     fontSize: 14,
//     color: '#666666',
//   },
//   listContent: {
//     paddingHorizontal: 16,
//   },
//   card: {
//     width: CARD_WIDTH,
//     height: 520,
//     borderRadius: 20,
//     backgroundColor: '#FFFFFF',
//     marginBottom: 20,
//     shadowColor: '#000000',
//     shadowOpacity: 0.15,
//     shadowOffset: { width: 0, height: 4 },
//     shadowRadius: 12,
//     elevation: 5,
//     overflow: 'hidden',
//   },
//   cardImage: {
//     width: '100%',
//     height: '100%',
//     resizeMode: 'cover',
//   },
//   placeholderImage: {
//     backgroundColor: '#E0E0E0',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   placeholderText: {
//     fontSize: 16,
//     color: '#999999',
//   },
//   cardOverlay: {
//     position: 'absolute',
//     bottom: 80,
//     left: 0,
//     right: 0,
//     paddingHorizontal: 20,
//     paddingVertical: 16,
//     backgroundColor: 'rgba(0, 0, 0, 0.3)',
//   },
//   cardInfo: {
//     gap: 4,
//   },
//   cardName: {
//     fontSize: 26,
//     fontWeight: '700',
//     color: '#FFFFFF',
//     textShadowColor: 'rgba(0, 0, 0, 0.3)',
//     textShadowOffset: { width: 0, height: 1 },
//     textShadowRadius: 4,
//   },
//   locationRow: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 4,
//   },
//   locationIcon: {
//     fontSize: 14,
//   },
//   cardLocation: {
//     fontSize: 16,
//     color: '#FFFFFF',
//     fontWeight: '500',
//     textShadowColor: 'rgba(0, 0, 0, 0.3)',
//     textShadowOffset: { width: 0, height: 1 },
//     textShadowRadius: 4,
//   },
//   actionButtons: {
//     position: 'absolute',
//     bottom: 20,
//     left: 0,
//     right: 0,
//     flexDirection: 'row',
//     justifyContent: 'center',
//     alignItems: 'center',
//     gap: 24,
//   },
//   actionButton: {
//     width: 64,
//     height: 64,
//     borderRadius: 32,
//     justifyContent: 'center',
//     alignItems: 'center',
//     shadowColor: '#000000',
//     shadowOpacity: 0.2,
//     shadowOffset: { width: 0, height: 2 },
//     shadowRadius: 8,
//     elevation: 4,
//   },
//   passButton: {
//     backgroundColor: '#FFFFFF',
//   },
//   likeButton: {
//     backgroundColor: '#FF6B6B',
//     width: 72,
//     height: 72,
//     borderRadius: 36,
//   },
//   actionIcon: {
//     fontSize: 28,
//   },
//   emptyState: {
//     alignItems: 'center',
//     paddingVertical: 60,
//     paddingHorizontal: 40,
//   },
//   emptyIcon: {
//     fontSize: 64,
//     marginBottom: 16,
//   },
//   emptyTitle: {
//     fontSize: 22,
//     fontWeight: '700',
//     color: '#1A1A1A',
//     marginBottom: 8,
//     textAlign: 'center',
//   },
//   emptySubtitle: {
//     fontSize: 15,
//     color: '#666666',
//     marginBottom: 24,
//     textAlign: 'center',
//   },
//   exploreButton: {
//     paddingHorizontal: 32,
//     paddingVertical: 14,
//     borderRadius: 25,
//     backgroundColor: '#FF6B6B',
//   },
//   exploreButtonText: {
//     fontSize: 16,
//     color: '#FFFFFF',
//     fontWeight: '700',
//   },
//   bottomNav: {
//     position: 'absolute',
//     bottom: 0,
//     left: 0,
//     right: 0,
//     flexDirection: 'row',
//     backgroundColor: '#FFFFFF',
//     paddingVertical: 8,
//     paddingBottom: 20,
//     borderTopWidth: 1,
//     borderTopColor: '#F0F0F0',
//     shadowColor: '#000000',
//     shadowOpacity: 0.08,
//     shadowOffset: { width: 0, height: -2 },
//     shadowRadius: 8,
//     elevation: 8,
//   },
//   navItem: {
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center',
//     paddingVertical: 4,
//   },
//   navIcon: {
//     width: 44,
//     height: 44,
//     borderRadius: 22,
//     backgroundColor: 'transparent',
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginBottom: 2,
//   },
//   navIconActive: {
//     width: 44,
//     height: 44,
//     borderRadius: 22,
//     backgroundColor: '#FFE8E8',
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginBottom: 2,
//   },
//   navIconText: {
//     fontSize: 22,
//   },
//   navLabel: {
//     fontSize: 11,
//     color: '#999999',
//     fontWeight: '500',
//   },
//   navLabelActive: {
//     color: '#FF6B6B',
//     fontWeight: '700',
//   },
// });

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  SafeAreaView,
  ScrollView,
  Share,
  Dimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { getDailySuggestions, SuggestionProfile, sendLike } from '../../services/matching';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const { width, height } = Dimensions.get('window');

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { user, profile } = useAuth();

  const LIKE_LIMIT_KEY = 'matching.likes_today';
  const LIKE_LIMIT = 50;

  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [suggestions, setSuggestions] = useState<SuggestionProfile[]>([]);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [liking, setLiking] = useState(false);
  const [likesToday, setLikesToday] = useState<{ date: string; count: number } | null>(null);

  const greetingName = profile?.name || user?.email || 'there';

  const { greetingLine, greetingSubtext } = useMemo(() => {
    const now = new Date();
    const hours = now.getHours();
    let sub = 'Ready to discover new connections?';
    if (hours >= 5 && hours < 12) {
      sub = 'Ready to start your day right?';
    } else if (hours >= 12 && hours < 17) {
      sub = 'Ready to discover new connections?';
    } else {
      sub = 'Ready to meet someone special?';
    }

    const weekday = now.toLocaleDateString(undefined, { weekday: 'long' });
    const month = now.toLocaleDateString(undefined, { month: 'long' });
    const day = now.getDate();
    const dateString = `${weekday}, ${month} ${day}`;

    return {
      greetingLine: `Hi, ${greetingName}!`,
      greetingSubtext: `${sub}  ·  ${dateString}`,
    };
  }, [greetingName]);

  const loadLikesToday = useCallback(async () => {
    const today = new Date().toISOString().substring(0, 10);
    const raw = await AsyncStorage.getItem(LIKE_LIMIT_KEY);
    if (raw) {
      try {
        const parsed: { date: string; count: number } = JSON.parse(raw);
        if (parsed.date === today) {
          setLikesToday(parsed);
          return;
        }
      } catch {
        // ignore parse errors
      }
    }
    const fresh = { date: today, count: 0 };
    setLikesToday(fresh);
    await AsyncStorage.setItem(LIKE_LIMIT_KEY, JSON.stringify(fresh));
  }, []);

  const incrementLikesToday = useCallback(async () => {
    const today = new Date().toISOString().substring(0, 10);
    const next = {
      date: today,
      count: (likesToday?.count ?? 0) + 1,
    };
    setLikesToday(next);
    await AsyncStorage.setItem(LIKE_LIMIT_KEY, JSON.stringify(next));
  }, [likesToday]);

  const loadSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    try {
      const data = await getDailySuggestions(5, 20);
      setSuggestions(data);
      setSuggestionIndex(0);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to load suggestions');
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  useEffect(() => {
    loadLikesToday();
    loadSuggestions();
  }, [loadLikesToday, loadSuggestions]);

  const visibleSuggestions = suggestions.slice(suggestionIndex, suggestionIndex + 5);

  const handlePass = () => {
    if (suggestionIndex + 1 >= suggestions.length) {
      Alert.alert('End of feed', 'Come back tomorrow for new suggestions.');
    } else {
      setSuggestionIndex((prev) => prev + 1);
    }
  };

  const handleLike = async (profileToLike: SuggestionProfile) => {
    if (!user) return;
    const todayCount = likesToday?.count ?? 0;
    if (todayCount >= LIKE_LIMIT) {
      Alert.alert('Limit reached', 'You have reached your daily like limit.');
      return;
    }

    setLiking(true);
    try {
      const { isMatch } = await sendLike(profileToLike.id);
      await incrementLikesToday();

      if (isMatch) {
        Alert.alert("It's a match!", `You and ${profileToLike.name} like each other.`);
      }
      handlePass();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to send like');
    } finally {
      setLiking(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: 'Check out this amazing dating app! Download now and find your match.',
        title: 'Share App',
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  const handleMessage = (profileId: string) => {
    Alert.alert('Send Message', 'This will open chat with this user.');
  };

  const PassIcon = () => (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 6l12 12M18 6L6 18"
        stroke="#F87171"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
    </Svg>
  );

  const LikeIcon = () => (
    <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12.001 5.5c-1.54-1.67-4.04-1.67-5.58 0-1.5 1.63-1.5 4.27 0 5.9l4.47 4.85a1 1 0 0 0 1.46 0l4.47-4.85c1.5-1.63 1.5-4.27 0-5.9-1.54-1.67-4.04-1.67-5.58 0Z"
        fill="#22C55E"
      />
    </Svg>
  );

  const MessageIcon = () => (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 5l16 7-16 7 3-7-3-7z"
        fill="#38BDF8"
        transform="rotate(-40 12 12)"
      />
    </Svg>
  );

  const HomeNavIcon = () => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 5.5C7.8 4 9.2 3 11 3c1.9 0 3.2 1.2 3.8 2.4.6 1.2.7 2.5.5 3.6-.3 1.5-1.1 2.8-2.2 3.9-.6.6-.9 1.4-.9 2.2V19a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.3C8 15.1 7.4 13.7 6.6 12.5 5.6 11 5 9.7 5 8.3c0-1.1.4-2.1 1-2.8Z"
        fill="#F97316"
      />
      <Path
        d="M11.5 9.5C12.2 8.3 13.2 7.5 14.5 7.5c1.3 0 2.3.8 2.7 1.8.4 1 .3 2-.1 2.9-.5 1.1-1.4 2.1-2.4 3-.3.3-.7.7-.7 1.3V18a.8.8 0 0 1-.8.8h-1a.8.8 0 0 1-.8-.8v-1.5c0-1-.3-1.9-.7-2.7-.4-.8-.7-1.6-.7-2.4 0-.8.3-1.6.8-1.9Z"
        fill="#FACC15"
      />
    </Svg>
  );

  const LikesNavIcon = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12.001 5.5c-1.54-1.67-4.04-1.67-5.58 0-1.5 1.63-1.5 4.27 0 5.9l4.47 4.85a1 1 0 0 0 1.46 0l4.47-4.85c1.5-1.63 1.5-4.27 0-5.9-1.54-1.67-4.04-1.67-5.58 0Z"
        fill="#FFFFFF"
      />
    </Svg>
  );

  const ExploreNavIcon = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z"
        stroke="#FFFFFF"
        strokeWidth={1.6}
      />
      <Path
        d="M10 14l1.2-3.8L15 9l-1.2 3.8L10 14Z"
        fill="#FFFFFF"
      />
    </Svg>
  );

  const ProfileNavIcon = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="#FFFFFF"
        strokeWidth={1.8}
      />
      <Path
        d="M6 19c.8-2.4 3.1-4 6-4s5.2 1.6 6 4"
        stroke="#FFFFFF"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );

  const MessagesNavIcon = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 6h14a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-6.5L8 20v-4H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
        stroke="#FFFFFF"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 11h6"
        stroke="#FFFFFF"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );

  const LocationIcon = () => (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3a6 6 0 0 0-6 6c0 4.2 4.5 8.7 5.6 9.8a.6.6 0 0 0 .8 0C13.5 17.7 18 13.2 18 9a6 6 0 0 0-6-6Z"
        stroke="#FFFFFF"
        strokeWidth={1.8}
      />
      <Path
        d="M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
        stroke="#FFFFFF"
        strokeWidth={1.8}
      />
    </Svg>
  );

  const renderSuggestionItem = ({ item }: { item: SuggestionProfile }) => {
    const photo = item.profile_photos?.[0] || (item as any).photos?.[0];
    return (
      <View style={styles.cardContainer}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.fullScreenImage} />
        ) : (
          <View style={[styles.fullScreenImage, styles.placeholderImage]}>
            <Text style={styles.placeholderText}>No Photo</Text>
          </View>
        )}
        
        {/* Bottom gradient overlay */}
        <View style={styles.bottomGradient} />

        {/* Profile info floating on image */}
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>
            {item.name} <Text style={styles.profileAge}>{item.age}</Text>
          </Text>
          <View style={styles.locationRow}>
            <LocationIcon />
            <Text style={styles.profileLocation}>
              {item.city}, {item.country}
            </Text>
          </View>
        </View>

        {/* Action buttons floating on image */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
       
            style={[styles.roundActionButton, styles.passButton]}
            onPress={handlePass}
            disabled={liking}
          >
            <PassIcon />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roundActionButton, styles.likeButton]}
            onPress={() => handleLike(item)}
            disabled={liking}
          >
            {liking ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <LikeIcon />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roundActionButton, styles.messageButton]}
            onPress={() => handleMessage(item.id)}
          >
            <MessageIcon />
          </TouchableOpacity>
        </View>

        {/* Info button (top right) */}
        <TouchableOpacity style={styles.infoButton}>
          <Text style={styles.infoButtonIcon}>ⓘ</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <View style={styles.shareIconCircle}>
              <Text style={styles.shareIcon}>➤</Text>
            </View>
          </TouchableOpacity>
        </View>

        {loadingSuggestions ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF6B6B" />
            <Text style={styles.loadingText}>Finding matches for you...</Text>
          </View>
        ) : suggestions.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Text style={styles.emptyIcon}>😊</Text>
            <Text style={styles.emptyTitle}>You've seen everyone for today!</Text>
            <Text style={styles.emptySubtitle}>
              Come back tomorrow for fresh matches
            </Text>
            <TouchableOpacity
              style={styles.exploreButton}
              onPress={() => navigation.navigate('Explore')}
            >
              <Text style={styles.exploreButtonText}>Explore More</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={visibleSuggestions}
            keyExtractor={(item) => item.id}
            renderItem={renderSuggestionItem}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.carousel}
          />
        )}

        {/* Bottom Navigation Bar */}
        <View style={styles.bottomNavContainer}>
          <View style={styles.bottomNav}>
            <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
              <View style={[styles.navIconCircle, styles.navIconActive]}>
                <HomeNavIcon />
              </View>
              <Text style={[styles.navLabel, styles.navLabelActive]}>Home</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Explore')}>
              <View style={styles.navIconCircle}>
                <ExploreNavIcon />
              </View>
              <Text style={styles.navLabel}>Explore</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Matches')}>
              <View style={styles.navIconCircle}>
                <LikesNavIcon />
              </View>
              <Text style={styles.navLabel}>Likes</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Matches')}>
              <View style={styles.navIconCircle}>
                <MessagesNavIcon />
              </View>
              <Text style={styles.navLabel}>Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('MyProfile')}>
              <View style={styles.navIconCircle}>
                <ProfileNavIcon />
              </View>
              <Text style={styles.navLabel}>Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  container: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  topBar: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  shareButton: {
    padding: 0,
  },
  shareIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  shareIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    transform: [{ rotate: '-45deg' }],
  },
  carousel: {
    flex: 1,
  },
  cardContainer: {
    width: width,
    height: height - 100,
    position: 'relative',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderImage: {
    backgroundColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 18,
    color: '#666666',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 280,
    backgroundColor: 'transparent',
    background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
  },
  profileInfo: {
    position: 'absolute',
    bottom: 160,
    left: 20,
    right: 20,
  },
  profileName: {
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  profileAge: {
    fontSize: 30,
    fontWeight: '400',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  profileLocation: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  actionButtonsRow: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  roundActionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 5,
  },
  passButton: {
  },
  likeButton: {
  },
  messageButton: {
  },
  infoButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoButtonIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#FFFFFF',
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    backgroundColor: '#1A1A1A',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#999999',
    marginBottom: 24,
    textAlign: 'center',
  },
  exploreButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    backgroundColor: '#FF6B6B',
  },
  exploreButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  bottomNavContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 32,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  navIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
    position: 'relative',
  },
  navIconActive: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
  },
  navIconText: {
    fontSize: 18,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    zIndex: 1,
  },
  badgeText: {
    fontSize: 11,
    color: '#1A1A1A',
    fontWeight: '700',
  },
  navLabel: {
    fontSize: 10,
    color: '#999999',
    fontWeight: '500',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#FF6B6B',
    fontWeight: '700',
  },
});