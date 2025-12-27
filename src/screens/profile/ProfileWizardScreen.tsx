import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, TouchableOpacity, FlatList, Image, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { INTEREST_TAGS } from '../../constants/interests';
import { Gender, RelationshipGoal, GenderPreference, Profile } from '../../types/profile';
import { uploadImageToCloudinary } from '../../utils/cloudinary';
import { supabase } from '../../config/supabaseClient';

const MIN_PHOTOS = 1;
const MAX_PHOTOS = 3;

export const ProfileWizardScreen: React.FC = () => {
  const { user, refreshProfile, signOut } = useAuth();
  const [step, setStep] = useState(1);
  const totalSteps = 3;

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
      if (prev.length >= 10) return prev;
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
      console.error('pickImage error', e);
    }
  };

  const removePhoto = (uri: string) => {
    setLocalPhotos((prev) => prev.filter((p) => p !== uri));
  };

  const canGoNext = () => {
    switch (step) {
      case 1:
        return !!name && !!age && Number(age) >= 18 && !!city && !!country && bio.length <= 500;
      case 2:
        return (
          !!relationshipGoal &&
          !!genderPreference &&
          interests.length >= 3 &&
          interests.length <= 10
        );
      case 3:
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

  const handleBackToLogin = async () => {
    await signOut();
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

  const getStepTitle = () => {
    switch (step) {
      case 1: return 'About You';
      case 2: return 'Preferences & Interests';
      case 3: return 'Your Photos';
      default: return '';
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.label}>Name</Text>
            <TextInput 
              style={styles.input} 
              value={name} 
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.label}>Age</Text>
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
              placeholder="18+"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.label}>Gender</Text>
            <View style={styles.chipRow}>
              {(['male', 'female', 'other'] as Gender[]).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, gender === g && styles.chipSelected]}
                  onPress={() => setGender(g)}
                >
                  <Text style={gender === g ? styles.chipTextSelected : styles.chipText}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>City</Text>
            <TextInput 
              style={styles.input} 
              value={city} 
              onChangeText={setCity}
              placeholder="Your city"
              placeholderTextColor="#9CA3AF"
            />
            
            <Text style={styles.label}>Country</Text>
            <TextInput 
              style={styles.input} 
              value={country} 
              onChangeText={setCountry}
              placeholder="Your country"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={500}
              placeholder="Tell us about yourself..."
              placeholderTextColor="#9CA3AF"
            />
            <Text style={styles.charCount}>{bio.length} / 500</Text>
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.label}>What are you looking for?</Text>
            <View style={styles.chipRow}>
              {(['serious', 'casual', 'both'] as RelationshipGoal[]).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, styles.fullWidthChip, relationshipGoal === g && styles.chipSelected]}
                  onPress={() => setRelationshipGoal(g)}
                >
                  <Text style={relationshipGoal === g ? styles.chipTextSelected : styles.chipText}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={styles.label}>Interested in</Text>
            <View style={styles.chipRow}>
              {(['male', 'female', 'other', 'all'] as GenderPreference[]).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, genderPreference === g && styles.chipSelected]}
                  onPress={() => setGenderPreference(g)}
                >
                  <Text style={genderPreference === g ? styles.chipTextSelected : styles.chipText}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={styles.label}>Pick 3–10 interests</Text>
            <View style={styles.interestsGrid}>
              {INTEREST_TAGS.map((item) => {
                const selected = interests.includes(item);
                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.chip, styles.interestChip, selected && styles.chipSelected]}
                    onPress={() => toggleInterest(item)}
                  >
                    <Text style={selected ? styles.chipTextSelected : styles.chipText}>{item}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.interestCount}>{interests.length} selected</Text>
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.label}>Add your photos</Text>
            <Text style={styles.subLabel}>
              Add {MIN_PHOTOS}-{MAX_PHOTOS} photos. Your first photo will be your main profile picture.
            </Text>
            
            <View style={styles.photoGrid}>
              {localPhotos.map((uri, index) => (
                <View key={uri} style={styles.photoContainer}>
                  <Image source={{ uri }} style={styles.photo} />
                  <TouchableOpacity 
                    style={styles.removeButton}
                    onPress={() => removePhoto(uri)}
                  >
                    <Text style={styles.removeButtonText}>✕</Text>
                  </TouchableOpacity>
                  {index === 0 && (
                    <View style={styles.mainBadge}>
                      <Text style={styles.mainBadgeText}>Main</Text>
                    </View>
                  )}
                </View>
              ))}
              
              {localPhotos.length < MAX_PHOTOS && (
                <TouchableOpacity style={styles.addPhotoButton} onPress={pickImage}>
                  <Text style={styles.addPhotoIcon}>+</Text>
                  <Text style={styles.addPhotoText}>Add Photo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.progressBar}>
          {[1, 2, 3].map((s) => (
            <View
              key={s}
              style={[
                styles.progressSegment,
                s <= step && styles.progressSegmentActive,
              ]}
            />
          ))}
        </View>
        <Text style={styles.stepTitle}>{getStepTitle()}</Text>
        <Text style={styles.stepSubtitle}>{progressLabel}</Text>
      </View>

      {step === 2 ? (
        <View style={styles.content}>{renderStep()}</View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {renderStep()}
        </ScrollView>
      )}

      <View style={styles.footer}>
        {step === 1 && (
          <TouchableOpacity style={styles.backToLoginButton} onPress={handleBackToLogin}>
            <Text style={styles.backToLoginText}>Back to login</Text>
          </TouchableOpacity>
        )}
        
        <View style={styles.footerButtons}>
          {step > 1 && (
            <TouchableOpacity style={styles.secondaryButton} onPress={handleBack}>
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          
          {step < totalSteps && (
            <TouchableOpacity 
              style={[styles.primaryButton, !canGoNext() && styles.buttonDisabled]} 
              onPress={handleNext}
              disabled={!canGoNext()}
            >
              <Text style={styles.primaryButtonText}>Next</Text>
            </TouchableOpacity>
          )}
          
          {step === totalSteps && (
            <TouchableOpacity
              style={[styles.primaryButton, (saving || uploading || !canGoNext()) && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={saving || uploading || !canGoNext()}
            >
              <Text style={styles.primaryButtonText}>
                {saving || uploading ? 'Saving...' : 'Finish'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 12,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  progressBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  progressSegmentActive: {
    backgroundColor: '#F97316',
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  stepSubtitle: {
    fontSize: 12,
    color: '#666666',
    fontWeight: '500',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },
  stepContainer: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 6,
    marginTop: 10,
  },
  subLabel: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 10,
    marginTop: -2,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
  },
  bioInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  fullWidthChip: {
    flex: 1,
    alignItems: 'center',
  },
  chipSelected: {
    backgroundColor: '#F97316',
    borderColor: '#F97316',
  },
  chipText: {
    color: '#1A1A1A',
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  interestChip: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
  },
  interestCount: {
    textAlign: 'center',
    fontSize: 13,
    color: '#F97316',
    fontWeight: '600',
    marginTop: 8,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  photoContainer: {
    position: 'relative',
    width: 105,
    height: 140,
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
  },
  removeButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  mainBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: '#F97316',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  mainBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  addPhotoButton: {
    width: 105,
    height: 140,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  addPhotoIcon: {
    fontSize: 28,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  addPhotoText: {
    fontSize: 11,
    color: '#666666',
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  backToLoginButton: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 10,
  },
  backToLoginText: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '600',
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#F97316',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#1A1A1A',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});