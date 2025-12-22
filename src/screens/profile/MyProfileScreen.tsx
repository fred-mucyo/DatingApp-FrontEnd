import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Button, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../context/AuthContext';
import { INTEREST_TAGS } from '../../constants/interests';
import { Gender, RelationshipGoal, GenderPreference } from '../../types/profile';
import { uploadImageToCloudinary } from '../../utils/cloudinary';
import { supabase } from '../../config/supabaseClient';

export type MyProfileScreenProps = NativeStackScreenProps<RootStackParamList, 'MyProfile'>;

const MIN_PHOTOS = 1;
const MAX_PHOTOS = 3;

export const MyProfileScreen: React.FC<MyProfileScreenProps> = () => {
  const { user, profile, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('other');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [relationshipGoal, setRelationshipGoal] = useState<RelationshipGoal>('both');
  const [genderPreference, setGenderPreference] = useState<GenderPreference>('all');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [localPhotos, setLocalPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }

    setName(profile.name ?? '');
    setAge(profile.age ? String(profile.age) : '');
    setGender(profile.gender as Gender);
    setCity(profile.city ?? '');
    setCountry(profile.country ?? '');
    setRelationshipGoal(profile.relationship_goal as RelationshipGoal);
    setGenderPreference(profile.gender_preference as GenderPreference);
    setBio(profile.bio ?? '');
    setInterests(profile.interests ?? []);
    setLocalPhotos(profile.photos ?? []);
    setLoading(false);
  }, [profile]);

  const toggleInterest = (tag: string) => {
    setInterests((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 10) return prev; // max 10
      return [...prev, tag];
    });
  };

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'We need access to your photos to upload.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        if (localPhotos.length >= MAX_PHOTOS) {
          Alert.alert('Limit reached', `You can upload up to ${MAX_PHOTOS} photos.`);
          return;
        }
        setLocalPhotos((prev) => [...prev, result.assets[0].uri]);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to open image picker');
    }
  };

  const removePhoto = (uri: string) => {
    setLocalPhotos((prev) => prev.filter((p) => p !== uri));
  };

  const setMainPhoto = (uri: string) => {
    setLocalPhotos((prev) => {
      const without = prev.filter((p) => p !== uri);
      return [uri, ...without];
    });
  };

  const validate = () => {
    if (!name.trim()) {
      Alert.alert('Invalid', 'Name is required.');
      return false;
    }
    if (!age || Number(age) < 18) {
      Alert.alert('Invalid', 'Age must be at least 18.');
      return false;
    }
    if (!city.trim() || !country.trim()) {
      Alert.alert('Invalid', 'City and country are required.');
      return false;
    }
    if (bio.length > 500) {
      Alert.alert('Invalid', 'Bio must be at most 500 characters.');
      return false;
    }
    if (interests.length < 3 || interests.length > 10) {
      Alert.alert('Invalid', 'Pick between 3 and 10 interests.');
      return false;
    }
    if (localPhotos.length < MIN_PHOTOS || localPhotos.length > MAX_PHOTOS) {
      Alert.alert('Invalid', `You must have between ${MIN_PHOTOS} and ${MAX_PHOTOS} photos.`);
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!user || !profile) return;
    if (!validate()) return;

    setSaving(true);
    try {
      setUploading(true);
      const uploaded: string[] = [];
      for (const uri of localPhotos) {
        // If URI is already a remote URL, keep as is
        if (uri.startsWith('http://') || uri.startsWith('https://')) {
          uploaded.push(uri);
        } else {
          const res = await uploadImageToCloudinary(uri);
          uploaded.push(res.url);
        }
      }
      setUploading(false);

      const payload = {
        name: name.trim(),
        age: Number(age),
        gender,
        city: city.trim(),
        country: country.trim(),
        bio: bio.trim() || null,
        relationship_goal: relationshipGoal,
        gender_preference: genderPreference,
        interests,
        photos: uploaded,
      };

      const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      await refreshProfile();
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Profile not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>My profile</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />

      <Text style={styles.label}>Age (18+)</Text>
      <TextInput
        style={styles.input}
        value={age}
        onChangeText={setAge}
        keyboardType="number-pad"
      />

      <Text style={styles.label}>Gender</Text>
      <View style={styles.chipRow}>
        {(['male', 'female', 'other'] as Gender[]).map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.chip, gender === g && styles.chipSelected]}
            onPress={() => setGender(g)}
          >
            <Text style={gender === g ? styles.chipTextSelected : styles.chipText}>{g}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>City</Text>
      <TextInput style={styles.input} value={city} onChangeText={setCity} />
      <Text style={styles.label}>Country</Text>
      <TextInput style={styles.input} value={country} onChangeText={setCountry} />

      <Text style={styles.label}>Relationship goal</Text>
      <View style={styles.chipRow}>
        {(['serious', 'casual', 'both'] as RelationshipGoal[]).map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.chip, relationshipGoal === g && styles.chipSelected]}
            onPress={() => setRelationshipGoal(g)}
          >
            <Text style={relationshipGoal === g ? styles.chipTextSelected : styles.chipText}>{g}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Who do you want to match with?</Text>
      <View style={styles.chipRow}>
        {(['male', 'female', 'other', 'all'] as GenderPreference[]).map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.chip, genderPreference === g && styles.chipSelected]}
            onPress={() => setGenderPreference(g)}
          >
            <Text style={genderPreference === g ? styles.chipTextSelected : styles.chipText}>{g}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Short bio (max 500 characters)</Text>
      <TextInput
        style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
        value={bio}
        onChangeText={setBio}
        multiline
        maxLength={500}
      />
      <Text style={styles.helper}>{bio.length} / 500</Text>

      <Text style={styles.label}>Pick 3–10 interests</Text>
      <View style={styles.chipRow}>
        {INTEREST_TAGS.map((tag) => {
          const selected = interests.includes(tag);
          return (
            <TouchableOpacity
              key={tag}
              style={[styles.chip, styles.interestChip, selected && styles.chipSelected]}
              onPress={() => toggleInterest(tag)}
            >
              <Text style={selected ? styles.chipTextSelected : styles.chipText}>{tag}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.helper}>Selected: {interests.length}</Text>

      <Text style={styles.label}>Photos ({MIN_PHOTOS}-{MAX_PHOTOS})</Text>
      <View style={styles.photoRow}>
        {localPhotos.map((uri, index) => (
          <View key={uri} style={styles.photoWrapper}>
            <TouchableOpacity onPress={() => removePhoto(uri)}>
              <Image source={{ uri }} style={styles.photo} />
            </TouchableOpacity>
            {index !== 0 && (
              <TouchableOpacity onPress={() => setMainPhoto(uri)}>
                <Text style={styles.setMain}>Set as main</Text>
              </TouchableOpacity>
            )}
            {index === 0 && <Text style={styles.mainBadge}>Main photo</Text>}
          </View>
        ))}
      </View>
      <Button title="Add photo" onPress={pickImage} />
      <Text style={styles.helper}>
        Tap a photo to remove it. Use "Set as main" to choose your main profile photo. You must
        keep between {MIN_PHOTOS} and {MAX_PHOTOS} photos.
      </Text>

      <View style={styles.footer}>
        <Button
          title={saving || uploading ? 'Saving...' : 'Save changes'}
          onPress={handleSave}
          disabled={saving || uploading}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  empty: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  label: {
    marginBottom: 4,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
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
  interestChip: {
    // same visual style, but we allow wrapping
  },
  helper: {
    marginTop: 4,
    marginBottom: 12,
    color: '#555',
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  photoWrapper: {
    marginRight: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  setMain: {
    marginTop: 4,
    fontSize: 11,
    color: '#2563eb',
  },
  mainBadge: {
    marginTop: 4,
    fontSize: 11,
    color: '#16a34a',
    fontWeight: '600',
  },
  footer: {
    marginTop: 16,
  },
});
