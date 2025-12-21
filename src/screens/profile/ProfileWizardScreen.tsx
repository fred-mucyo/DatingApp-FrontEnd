import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, TouchableOpacity, FlatList, Image, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { INTEREST_TAGS } from '../../constants/interests';
import { Gender, RelationshipGoal, GenderPreference, Profile } from '../../types/profile';
import { uploadImageToCloudinary } from '../../utils/cloudinary';
import { supabase } from '../../config/supabaseClient';

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 5;

export const ProfileWizardScreen: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const totalSteps = 6;

  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('other');

  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  const [relationshipGoal, setRelationshipGoal] = useState<RelationshipGoal>('both');
  const [genderPreference, setGenderPreference] = useState<GenderPreference>('all');

  const [interests, setInterests] = useState<string[]>([]);

  const [bio, setBio] = useState('');

  const [localPhotos, setLocalPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const progressLabel = useMemo(() => `Step ${step} of ${totalSteps}`, [step]);

  const toggleInterest = (tag: string) => {
    setInterests((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 10) return prev; // max 10
      return [...prev, tag];
    });
  };

  const pickImage = async () => {
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
  };

  const removePhoto = (uri: string) => {
    setLocalPhotos((prev) => prev.filter((p) => p !== uri));
  };

  const canGoNext = () => {
    switch (step) {
      case 1:
        return !!name && !!age && Number(age) >= 18;
      case 2:
        return !!city && !!country && bio.length <= 500;
      case 3:
        return !!relationshipGoal;
      case 4:
        return !!genderPreference;
      case 5:
        return interests.length >= 3 && interests.length <= 10;
      case 6:
        return localPhotos.length >= MIN_PHOTOS && localPhotos.length <= MAX_PHOTOS;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!canGoNext()) {
      Alert.alert('Incomplete', 'Please complete this step before continuing.');
      return;
    }
    if (step < totalSteps) setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!canGoNext()) {
      Alert.alert('Incomplete', 'Please complete all steps.');
      return;
    }

    setSaving(true);
    try {
      setUploading(true);
      const uploaded: string[] = [];
      for (const uri of localPhotos) {
        const res = await uploadImageToCloudinary(uri);
        uploaded.push(res.url);
      }
      setUploading(false);

      const payload: Partial<Profile> = {
        id: user.id,
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
        is_complete: true,
      };

      const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      await refreshProfile();
      Alert.alert('Profile saved', 'Your profile is complete. You can now use the app.');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View>
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
          </View>
        );
      case 2:
        return (
          <View>
            <Text style={styles.label}>City</Text>
            <TextInput style={styles.input} value={city} onChangeText={setCity} />
            <Text style={styles.label}>Country</Text>
            <TextInput style={styles.input} value={country} onChangeText={setCountry} />

            <Text style={styles.label}>Short bio (max 500 characters)</Text>
            <TextInput
              style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={500}
            />
            <Text style={styles.helper}>{bio.length} / 500</Text>
          </View>
        );
      case 3:
        return (
          <View>
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
          </View>
        );
      case 4:
        return (
          <View>
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
          </View>
        );
      case 5:
        return (
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Pick 3–10 interests</Text>
            <FlatList
              data={INTEREST_TAGS}
              keyExtractor={(item) => item}
              numColumns={2}
              renderItem={({ item }) => {
                const selected = interests.includes(item);
                return (
                  <TouchableOpacity
                    style={[styles.chip, styles.interestChip, selected && styles.chipSelected]}
                    onPress={() => toggleInterest(item)}
                  >
                    <Text style={selected ? styles.chipTextSelected : styles.chipText}>{item}</Text>
                  </TouchableOpacity>
                );
              }}
            />
            <Text style={styles.helper}>Selected: {interests.length}</Text>
          </View>
        );
      case 6:
        return (
          <View>
            <Text style={styles.label}>Upload {MIN_PHOTOS}-{MAX_PHOTOS} photos</Text>
            <View style={styles.photoRow}>
              {localPhotos.map((uri) => (
                <TouchableOpacity key={uri} onPress={() => removePhoto(uri)}>
                  <Image source={{ uri }} style={styles.photo} />
                </TouchableOpacity>
              ))}
            </View>
            <Button title="Add photo" onPress={pickImage} />
            <Text style={styles.helper}>
              Tap a photo to remove it. You must upload at least {MIN_PHOTOS} photos.
            </Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.progress}>{progressLabel}</Text>
      <ScrollView contentContainerStyle={styles.content}>{renderStep()}</ScrollView>
      <View style={styles.footer}>
        <View style={styles.footerButtons}>
          {step > 1 && <Button title="Back" onPress={handleBack} />}
          {step < totalSteps && (
            <Button title="Next" onPress={handleNext} disabled={!canGoNext()} />
          )}
          {step === totalSteps && (
            <Button
              title={saving || uploading ? 'Saving...' : 'Finish'}
              onPress={handleSave}
              disabled={saving || uploading || !canGoNext()}
            />
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  progress: {
    textAlign: 'center',
    marginBottom: 8,
    fontSize: 14,
    color: '#555',
  },
  content: {
    flexGrow: 1,
    paddingBottom: 16,
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
    flex: 1,
  },
  helper: {
    marginTop: 8,
    color: '#555',
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  footer: {
    paddingVertical: 8,
  },
  footerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
