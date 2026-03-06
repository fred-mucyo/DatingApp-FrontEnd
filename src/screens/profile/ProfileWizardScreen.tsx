import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ScrollView,
  Image,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Dimensions,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { INTEREST_TAGS } from '../../constants/interests';
import { Gender, RelationshipGoal, GenderPreference, Profile } from '../../types/profile';
import { uploadImageToCloudinary } from '../../utils/cloudinary';
import { supabase } from '../../config/supabaseClient';
import { cacheService } from '../../services/cache';

const MIN_PHOTOS = 1;
const MAX_PHOTOS = 3;

export const ProfileWizardScreen: React.FC = () => {
  const { user, refreshProfile, signOut } = useAuth();
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  const [name, setName] = useState('');
  const [dob, setDob] = useState<{ day: number; month: number; year: number } | null>(null);
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

  const [dobPickerOpen, setDobPickerOpen] = useState(false);
  const [dobPickerPart, setDobPickerPart] = useState<'day' | 'month' | 'year'>('day');

  const sanitizeLettersOnly = (value: string) => value.replace(/[^A-Za-z '\-]/g, '');

  const isValidLettersValue = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    return /^[A-Za-z]+([ '\-][A-Za-z]+)*$/.test(trimmed);
  };

  const computeAgeFromDob = (d: { day: number; month: number; year: number }) => {
    const now = new Date();
    const birth = new Date(Date.UTC(d.year, d.month - 1, d.day));
    if (Number.isNaN(birth.getTime())) return null;
    let age = now.getUTCFullYear() - birth.getUTCFullYear();
    const m = now.getUTCMonth() - birth.getUTCMonth();
    if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) age -= 1;
    if (age < 0 || age > 120) return null;
    return age;
  };

  const dobIso = useMemo(() => {
    if (!dob) return null;
    const mm = String(dob.month).padStart(2, '0');
    const dd = String(dob.day).padStart(2, '0');
    return `${dob.year}-${mm}-${dd}`;
  }, [dob]);

  const computedAge = useMemo(() => (dob ? computeAgeFromDob(dob) : null), [dob]);

  const isValidName = useMemo(() => {
    return isValidLettersValue(name);
  }, [name]);

  const isValidCity = useMemo(() => isValidLettersValue(city), [city]);
  const isValidCountry = useMemo(() => isValidLettersValue(country), [country]);

  const dobLooksValid = useMemo(() => {
    if (!dob) return false;
    const age = computeAgeFromDob(dob);
    return age !== null && age >= 18;
  }, [dob]);

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
        return (
          isValidName &&
          dobLooksValid &&
          isValidCity &&
          isValidCountry &&
          bio.length <= 500
        );
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
      if (step === 1 && !isValidName) {
        Alert.alert('Invalid name', "Name must contain letters only. You can use spaces, hyphens, and apostrophes.");
        return;
      }
      if (step === 1 && !dobLooksValid) {
        Alert.alert('Invalid date of birth', 'Please select a valid date of birth. You must be at least 18.');
        return;
      }
      if (step === 1 && (!isValidCity || !isValidCountry)) {
        Alert.alert('Invalid location', 'City and country must contain letters only.');
        return;
      }
      if (step === 3 && localPhotos.length < MIN_PHOTOS) {
        Alert.alert('Add a photo', `Please add at least ${MIN_PHOTOS} profile photo to continue.`);
        return;
      }
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

    if (!dob || !dobIso) {
      Alert.alert('Invalid', 'Please select your date of birth.');
      return;
    }
    const ageToSave = computeAgeFromDob(dob);
    if (ageToSave === null || ageToSave < 18) {
      Alert.alert('Invalid', 'Please select a valid date of birth. You must be at least 18.');
      return;
    }

    setSaving(true);
    try {
      setUploading(true);
      const uploadResults = await Promise.all(localPhotos.map((uri) => uploadImageToCloudinary(uri)));
      const uploaded = uploadResults.map((r) => r.url);
      setUploading(false);

      const payload: Partial<Profile> = {
        id: user.id,
        name: name.trim(),
        age: ageToSave,
        date_of_birth: dobIso,
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

      const existingCached = await cacheService.getProfile(user.id);
      await cacheService.setProfile(user.id, { ...(existingCached ?? {}), ...payload });
      refreshProfile();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save profile');
    } finally {
      setUploading(false);
      setSaving(false);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 1:
        return 'About You';
      case 2:
        return 'Preferences & Interests';
      case 3:
        return 'Your Photos';
      default:
        return '';
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.label}>Display name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={(t) => setName(sanitizeLettersOnly(t))}
              placeholder="Enter your display name"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.label}>Date of birth</Text>
            <TouchableOpacity
              style={[styles.input, styles.dobRow]}
              onPress={() => setDobPickerOpen(true)}
              activeOpacity={0.85}
            >
              <Text style={dob ? styles.dobText : styles.dobPlaceholder}>
                {dob ? `${String(dob.day).padStart(2, '0')}/${String(dob.month).padStart(2, '0')}/${dob.year}` : 'Select day / month / year'}
              </Text>
              {computedAge !== null ? <Text style={styles.dobAge}>{computedAge}</Text> : null}
            </TouchableOpacity>

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
              onChangeText={(t) => setCity(sanitizeLettersOnly(t))}
              placeholder="Your city"
              placeholderTextColor="#9CA3AF"
            />
            
            <Text style={styles.label}>Country</Text>
            <TextInput
              style={styles.input}
              value={country}
              onChangeText={(t) => setCountry(sanitizeLettersOnly(t))}
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
                  <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
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
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.background}>
              <BackgroundArt />

              <View style={styles.centerWrap}>
                <View style={[styles.card, { width: CARD_MAX_W }]}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.stepTitle}>{getStepTitle()}</Text>
                    <Text style={styles.stepSubtitle}>{progressLabel}</Text>
                    <View style={styles.progressBar}>
                      {[1, 2, 3].map((s) => (
                        <View
                          key={s}
                          style={[styles.progressSegment, s <= step && styles.progressSegmentActive]}
                        />
                      ))}
                    </View>
                  </View>

                  {renderStep()}

                  <View style={styles.footerButtons}>
                    {step > 1 ? (
                      <TouchableOpacity style={styles.secondaryButton} onPress={handleBack}>
                        <Text style={styles.secondaryButtonText}>Back</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={styles.secondaryButton} onPress={handleBackToLogin}>
                        <Text style={styles.secondaryButtonText}>Sign out</Text>
                      </TouchableOpacity>
                    )}

                    {step < totalSteps ? (
                      <TouchableOpacity
                        style={[styles.primaryButton, !canGoNext() && styles.buttonDisabled]}
                        onPress={handleNext}
                        disabled={!canGoNext()}
                      >
                        <Text style={styles.primaryButtonText}>Next</Text>
                      </TouchableOpacity>
                    ) : (
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

              <Modal
                visible={dobPickerOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setDobPickerOpen(false)}
              >
                <TouchableOpacity
                  style={styles.modalOverlay}
                  activeOpacity={1}
                  onPress={() => setDobPickerOpen(false)}
                >
                  <TouchableOpacity style={styles.modalCard} activeOpacity={1}>
                    <Text style={styles.modalTitle}>Select date of birth</Text>

                    <View style={styles.modalTabs}>
                      {(['day', 'month', 'year'] as const).map((p) => (
                        <TouchableOpacity
                          key={p}
                          style={[styles.modalTab, dobPickerPart === p && styles.modalTabActive]}
                          onPress={() => setDobPickerPart(p)}
                        >
                          <Text style={[styles.modalTabText, dobPickerPart === p && styles.modalTabTextActive]}>
                            {p.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <FlatList
                      data={(() => {
                        const now = new Date();
                        if (dobPickerPart === 'day') return Array.from({ length: 31 }, (_, i) => i + 1);
                        if (dobPickerPart === 'month') return Array.from({ length: 12 }, (_, i) => i + 1);
                        const maxYear = now.getFullYear() - 18;
                        const minYear = now.getFullYear() - 120;
                        const years: number[] = [];
                        for (let y = maxYear; y >= minYear; y--) years.push(y);
                        return years;
                      })()}
                      keyExtractor={(item) => String(item)}
                      style={styles.modalList}
                      renderItem={({ item }) => {
                        const current = dob ?? { day: 1, month: 1, year: new Date().getFullYear() - 18 };
                        const next = {
                          day: dobPickerPart === 'day' ? item : current.day,
                          month: dobPickerPart === 'month' ? item : current.month,
                          year: dobPickerPart === 'year' ? item : current.year,
                        };
                        const selected =
                          (dobPickerPart === 'day' && current.day === item) ||
                          (dobPickerPart === 'month' && current.month === item) ||
                          (dobPickerPart === 'year' && current.year === item);
                        return (
                          <TouchableOpacity
                            style={[styles.modalListItem, selected && styles.modalListItemSelected]}
                            onPress={() => {
                              setDob(next);
                              if (dobPickerPart === 'day') setDobPickerPart('month');
                              else if (dobPickerPart === 'month') setDobPickerPart('year');
                            }}
                          >
                            <Text style={[styles.modalListItemText, selected && styles.modalListItemTextSelected]}>
                              {String(item).padStart(2, '0')}
                            </Text>
                          </TouchableOpacity>
                        );
                      }}
                    />

                    <TouchableOpacity
                      style={styles.modalDone}
                      onPress={() => setDobPickerOpen(false)}
                    >
                      <Text style={styles.modalDoneText}>Done</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                </TouchableOpacity>
              </Modal>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ff5f6d',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  background: {
    flex: 1,
    paddingHorizontal: 20,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 25,
    elevation: 10,
  },
  cardHeader: {
    marginBottom: 12,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  progressSegmentActive: {
    backgroundColor: '#ff4b2b',
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
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
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
  },
  dobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dobPlaceholder: {
    color: '#9CA3AF',
    fontSize: 15,
  },
  dobText: {
    color: '#1A1A1A',
    fontSize: 15,
    fontWeight: '600',
  },
  dobAge: {
    color: '#ff4b2b',
    fontSize: 14,
    fontWeight: '800',
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
    backgroundColor: '#ff4b2b',
    borderColor: '#ff4b2b',
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
    color: '#ff4b2b',
    fontWeight: '600',
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
    backgroundColor: '#ff4b2b',
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
  footerButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#ff4b2b',
    borderRadius: 14,
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
    borderRadius: 14,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 18,
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  modalTabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  modalTab: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTabActive: {
    borderColor: '#ff4b2b',
    backgroundColor: 'rgba(255,75,43,0.08)',
  },
  modalTabText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
  },
  modalTabTextActive: {
    color: '#ff4b2b',
  },
  modalList: {
    marginTop: 12,
    maxHeight: 260,
  },
  modalListItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  modalListItemSelected: {
    backgroundColor: 'rgba(255,75,43,0.10)',
  },
  modalListItemText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  modalListItemTextSelected: {
    color: '#ff4b2b',
  },
  modalDone: {
    marginTop: 12,
    backgroundColor: '#ff4b2b',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDoneText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_MAX_W = Math.min(SCREEN_W - 40, 440);

const BackgroundArt = () => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    <Svg width="100%" height="100%" viewBox="0 0 360 800" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#ff5f6d" />
          <Stop offset="1" stopColor="#ffc371" />
        </LinearGradient>

        <RadialGradient id="glow1" cx="20%" cy="18%" rx="60%" ry="60%" fx="20%" fy="18%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.28" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="glow2" cx="85%" cy="40%" rx="55%" ry="55%" fx="85%" fy="40%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.20" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Rect x="0" y="0" width="360" height="800" fill="url(#bg)" />
      <Rect x="0" y="0" width="360" height="800" fill="url(#glow1)" />
      <Rect x="0" y="0" width="360" height="800" fill="url(#glow2)" />

      <Circle cx="70" cy="150" r="36" fill="#fff" opacity="0.10" />
      <Circle cx="310" cy="240" r="46" fill="#fff" opacity="0.08" />
      <Circle cx="260" cy="120" r="22" fill="#fff" opacity="0.10" />
      <Circle cx="100" cy="320" r="26" fill="#fff" opacity="0.08" />
      <Circle cx="40" cy="580" r="40" fill="#fff" opacity="0.08" />
      <Circle cx="320" cy="640" r="34" fill="#fff" opacity="0.08" />

      <Path
        d="M62 94c-7-9-23-3-21 10 2 15 21 25 21 25s19-10 21-25c2-13-14-19-21-10Z"
        fill="#fff"
        opacity="0.14"
      />
      <Path
        d="M300 164c-6-8-20-2-18 9 2 12 18 20 18 20s16-8 18-20c2-11-12-17-18-9Z"
        fill="#fff"
        opacity="0.12"
      />
      <Path
        d="M72 690c-8-10-26-4-24 11 2 16 24 28 24 28s22-12 24-28c2-15-16-21-24-11Z"
        fill="#fff"
        opacity="0.12"
      />
      <Path
        d="M310 560c-7-9-23-3-21 10 2 15 21 25 21 25s19-10 21-25c2-13-14-19-21-10Z"
        fill="#fff"
        opacity="0.10"
      />
    </Svg>
  </View>
);