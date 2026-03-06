import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Button, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView, Image, Share, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../context/AuthContext';
import { INTEREST_TAGS } from '../../constants/interests';
import { Gender, RelationshipGoal, GenderPreference } from '../../types/profile';
import { uploadImageToCloudinary } from '../../utils/cloudinary';
import { supabase } from '../../config/supabaseClient';
import { deleteMyAccount, requestMyDataExport } from '../../services/account';

export type MyProfileScreenProps = NativeStackScreenProps<RootStackParamList, 'MyProfile'>;

const MIN_PHOTOS = 1;
const MAX_PHOTOS = 3;

export const MyProfileScreen: React.FC<MyProfileScreenProps> = ({ navigation }) => {
  const { user, profile, refreshProfile, signOut } = useAuth();

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

  const isValidName = () => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    return /^[A-Za-z]+([ '\-][A-Za-z]+)*$/.test(trimmed);
  };

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
    if (!isValidName()) {
      Alert.alert('Invalid', "Name must contain letters only. You can use spaces, hyphens, and apostrophes.");
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

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          // We rely on AuthContext signOut to clear session and profile
          // RootNavigator will then show the auth stack (Login screen).
          signOut().catch(() => {
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          });
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    if (!user) return;

    Alert.alert(
      'Delete account',
      'This will permanently delete your account and your data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await deleteMyAccount(user.id);
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Failed to delete account');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const handleExportMyData = async () => {
    if (!user) return;
    try {
      const { fileName, contents } = await requestMyDataExport();

      const baseDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
      if (!baseDir) {
        throw new Error('Missing local storage directory.');
      }

      const safeBaseDir = baseDir.endsWith('/') ? baseDir : `${baseDir}/`;
      const localFileUri = `${safeBaseDir}${fileName}`;

      await FileSystem.writeAsStringAsync(localFileUri, contents, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
        const perms = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (perms.granted) {
          const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
            perms.directoryUri,
            fileName,
            'application/json',
          );
          await FileSystem.writeAsStringAsync(destUri, contents, {
            encoding: FileSystem.EncodingType.UTF8,
          });

          Alert.alert('Saved', `Your export was saved as ${fileName}.`);
          return;
        }
      }

      await Share.share({
        url: localFileUri,
        message: 'Your Umutima data export is ready.',
        title: 'Umutima data export',
      });

      Alert.alert('Saved', `Your export file is available as ${fileName}.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to request data export');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#F97316" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.empty}>Profile not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>My Profile</Text>
          <Text style={styles.subtitle}>Keep your profile up to date</Text>
          {profile.username ? <Text style={styles.username}>@{profile.username}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.card}>
            <Text style={styles.label}>Name</Text>
            <TextInput 
              style={styles.input} 
              value={name} 
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor="#9CA3AF"
            />

            <View style={styles.halfInput}>
              <Text style={styles.label}>Age</Text>
              <TextInput
                style={styles.input}
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                placeholder="18+"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <Text style={styles.label}>Gender</Text>
            <View style={styles.chipRow}>
              {(['male', 'female', 'other'] as Gender[]).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, gender === g && styles.chipSelected]}
                  onPress={() => setGender(g)}
                  activeOpacity={0.7}
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
              placeholder="Enter your city"
              placeholderTextColor="#9CA3AF"
            />
            
            <Text style={styles.label}>Country</Text>
            <TextInput 
              style={styles.input} 
              value={country} 
              onChangeText={setCountry}
              placeholder="Enter your country"
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          
          <View style={styles.card}>
            <Text style={styles.label}>Relationship goal</Text>
            <View style={styles.chipRow}>
              {(['serious', 'casual', 'both'] as RelationshipGoal[]).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, relationshipGoal === g && styles.chipSelected]}
                  onPress={() => setRelationshipGoal(g)}
                  activeOpacity={0.7}
                >
                  <Text style={relationshipGoal === g ? styles.chipTextSelected : styles.chipText}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
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
                  activeOpacity={0.7}
                >
                  <Text style={genderPreference === g ? styles.chipTextSelected : styles.chipText}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About You</Text>
          
          <View style={styles.card}>
            <Text style={styles.label}>Short bio</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={500}
              placeholder="Tell us about yourself..."
              placeholderTextColor="#9CA3AF"
            />
            <Text style={styles.charCount}>{bio.length} / 500 characters</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interests</Text>
          <Text style={styles.sectionSubtitle}>Pick 3–10 interests</Text>
          
          <View style={styles.card}>
            <View style={styles.chipRow}>
              {INTEREST_TAGS.map((tag) => {
                const selected = interests.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.chip, styles.interestChip, selected && styles.chipSelected]}
                    onPress={() => toggleInterest(tag)}
                    activeOpacity={0.7}
                  >
                    <Text style={selected ? styles.chipTextSelected : styles.chipText}>{tag}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.interestCounter}>
              <Text style={styles.counterText}>
                Selected: {interests.length} {interests.length < 3 && '(minimum 3)'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <Text style={styles.sectionSubtitle}>Add {MIN_PHOTOS}-{MAX_PHOTOS} photos</Text>
          
          <View style={styles.card}>
            <View style={styles.photoGrid}>
              {localPhotos.map((uri, index) => (
                <View key={uri} style={styles.photoWrapper}>
                  <TouchableOpacity 
                    onPress={() => removePhoto(uri)}
                    style={styles.photoContainer}
                    activeOpacity={0.9}
                  >
                    <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
                    <View style={styles.removeOverlay}>
                      <Text style={styles.removeText}>✕</Text>
                    </View>
                  </TouchableOpacity>
                  {index === 0 ? (
                    <View style={styles.mainBadgeContainer}>
                      <Text style={styles.mainBadge}>Main photo</Text>
                    </View>
                  ) : (
                    <TouchableOpacity 
                      onPress={() => setMainPhoto(uri)}
                      style={styles.setMainButton}
                    >
                      <Text style={styles.setMainText}>Set as main</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
            
            {localPhotos.length < MAX_PHOTOS && (
              <TouchableOpacity 
                style={styles.addPhotoButton}
                onPress={pickImage}
                activeOpacity={0.7}
              >
                <Text style={styles.addPhotoIcon}>📷</Text>
                <Text style={styles.addPhotoText}>Add photo</Text>
              </TouchableOpacity>
            )}
            
            <Text style={styles.photoHelper}>
              Tap the ✕ to remove a photo. Use "Set as main" to choose your profile photo.
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, (saving || uploading) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving || uploading}
            activeOpacity={0.8}
          >
            {(saving || uploading) ? (
              <>
                <ActivityIndicator color="#FFFFFF" style={styles.buttonLoader} />
                <Text style={styles.saveButtonText}>
                  {uploading ? 'Uploading photos...' : 'Saving...'}
                </Text>
              </>
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            activeOpacity={0.8}
          >
            <Text style={styles.signOutButtonText}>Sign out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.supportButton}
            onPress={() => navigation.navigate('SupportCenter')}
            activeOpacity={0.8}
          >
            <Text style={styles.supportButtonText}>Support Center</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.supportButton}
            onPress={() => navigation.navigate('TermsOfService')}
            activeOpacity={0.8}
          >
            <Text style={styles.supportButtonText}>Terms of Service</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.supportButton}
            onPress={() => navigation.navigate('PrivacyPolicy')}
            activeOpacity={0.8}
          >
            <Text style={styles.supportButtonText}>Privacy Policy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.supportButton}
            onPress={() => navigation.navigate('RequestVerification')}
            activeOpacity={0.8}
            disabled={saving}
          >
            <Text style={styles.supportButtonText}>Request verification</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.supportButton}
            onPress={handleExportMyData}
            activeOpacity={0.8}
            disabled={saving}
          >
            <Text style={styles.supportButtonText}>Export my data</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteAccount}
            activeOpacity={0.8}
            disabled={saving}
          >
            <Text style={styles.deleteButtonText}>Delete account</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#666666',
    fontWeight: '500',
  },
  empty: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#666666',
  },
  username: {
    marginTop: 6,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  label: {
    marginBottom: 8,
    fontWeight: '700',
    fontSize: 14,
    color: '#1A1A1A',
    letterSpacing: -0.2,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    fontSize: 15,
    color: '#1A1A1A',
    backgroundColor: '#FAFAFA',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  bioInput: {
    height: 120,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  charCount: {
    marginTop: -8,
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
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
  interestChip: {
    // same visual style
  },
  interestCounter: {
    marginTop: -8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  counterText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  photoWrapper: {
    marginRight: 12,
    marginBottom: 12,
  },
  photoContainer: {
    position: 'relative',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  removeOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  mainBadgeContainer: {
    marginTop: 6,
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'center',
  },
  mainBadge: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  setMainButton: {
    marginTop: 6,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignSelf: 'center',
  },
  setMainText: {
    fontSize: 11,
    color: '#6366F1',
    fontWeight: '600',
  },
  addPhotoButton: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
    marginBottom: 12,
  },
  addPhotoIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  addPhotoText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '600',
  },
  photoHelper: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
  footer: {
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: '#F97316',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F97316',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
    flexDirection: 'row',
  },
  saveButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
  },
  buttonLoader: {
    marginRight: 8,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  signOutButton: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  signOutButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },
  supportButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  supportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  deleteButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#B91C1C',
  },
});