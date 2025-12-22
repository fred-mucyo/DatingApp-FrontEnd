import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Button, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
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
        {mainPhoto ? <Image source={{ uri: mainPhoto }} style={styles.photo} /> : <View style={styles.photoPlaceholder} />}
        <View style={styles.info}>
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
    <View style={styles.container}>
      <Text style={styles.title}>Explore users</Text>

      <View style={styles.filtersRow}>
        <View style={styles.filterColumn}>
          <Text style={styles.filterLabel}>Gender</Text>
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
      </View>

      <View style={styles.filtersRow}>
        <View style={styles.filterColumn}>
          <Text style={styles.filterLabel}>Location</Text>
          <TextInput
            style={styles.input}
            placeholder="City or country"
            value={locationFilter}
            onChangeText={setLocationFilter}
          />
        </View>
      </View>

      <View style={styles.filtersRow}>
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

      <View style={styles.searchButtonRow}>
        <Button title="Search" onPress={handleSearch} disabled={loading} />
      </View>

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
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  filtersRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  filterColumn: {
    flex: 1,
  },
  filterColumnHalf: {
    flex: 1,
    marginRight: 8,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    borderWidth: 1,
    borderColor: '#ccc',
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
  searchButtonRow: {
    marginTop: 8,
    alignItems: 'center',
    marginBottom: 8,
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
  },
  card: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  photo: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginRight: 12,
  },
  photoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: '#e5e7eb',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  meta: {
    fontSize: 12,
    color: '#6b7280',
  },
});
