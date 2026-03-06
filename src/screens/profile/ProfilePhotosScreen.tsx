import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../context/AuthContext';
import { uploadImageToCloudinary } from '../../utils/cloudinary';
import { supabase } from '../../config/supabaseClient';

export type ProfilePhotosScreenProps = NativeStackScreenProps<RootStackParamList, 'ProfilePhotos'>;

const MIN_PHOTOS = 1;
const MAX_PHOTOS = 3;

export const ProfilePhotosScreen: React.FC<ProfilePhotosScreenProps> = ({ navigation }) => {
  const { user, profile, refreshProfile } = useAuth();

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localPhotos, setLocalPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (!profile) return;
    setLocalPhotos(profile.photos ?? []);
  }, [profile]);

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
        if (uri.startsWith('http://') || uri.startsWith('https://')) {
          uploaded.push(uri);
        } else {
          const res = await uploadImageToCloudinary(uri);
          uploaded.push(res.url);
        }
      }
      setUploading(false);

      const payload = {
        photos: uploaded,
      };

      const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      await refreshProfile();
      Alert.alert('Saved', 'Your photos have been updated.');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save photos');
    } finally {
      setUploading(false);
      setSaving(false);
    }
  };

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
        <View style={styles.card}>
          <Text style={styles.helperTitle}>Your photos</Text>
          <Text style={styles.helperText}>Add {MIN_PHOTOS}-{MAX_PHOTOS} photos</Text>

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
                  <TouchableOpacity onPress={() => setMainPhoto(uri)} style={styles.setMainButton}>
                    <Text style={styles.setMainText}>Set as main</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          {localPhotos.length < MAX_PHOTOS && (
            <TouchableOpacity style={styles.addPhotoButton} onPress={pickImage} activeOpacity={0.7}>
              <Text style={styles.addPhotoIcon}>📷</Text>
              <Text style={styles.addPhotoText}>Add photo</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.photoHelper}>
            Tap the ✕ to remove a photo. Use "Set as main" to choose your profile photo.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, (saving || uploading) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving || uploading}
          activeOpacity={0.85}
        >
          {(saving || uploading) ? (
            <>
              <ActivityIndicator color="#FFFFFF" style={styles.buttonLoader} />
              <Text style={styles.saveButtonText}>{uploading ? 'Uploading...' : 'Saving...'}</Text>
            </>
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
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
  empty: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
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
  helperTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  helperText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    fontWeight: '600',
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
    width: 110,
    height: 110,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  removeOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
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
    fontWeight: '800',
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
    fontWeight: '800',
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
    fontWeight: '700',
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
    fontWeight: '700',
  },
  photoHelper: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
  saveButton: {
    marginTop: 16,
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
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
