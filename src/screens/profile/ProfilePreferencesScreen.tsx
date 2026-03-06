import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../context/AuthContext';
import { INTEREST_TAGS } from '../../constants/interests';
import { RelationshipGoal, GenderPreference } from '../../types/profile';
import { supabase } from '../../config/supabaseClient';

export type ProfilePreferencesScreenProps = NativeStackScreenProps<RootStackParamList, 'ProfilePreferences'>;

export const ProfilePreferencesScreen: React.FC<ProfilePreferencesScreenProps> = ({ navigation }) => {
  const { user, profile, refreshProfile } = useAuth();

  const [saving, setSaving] = useState(false);

  const [relationshipGoal, setRelationshipGoal] = useState<RelationshipGoal>('both');
  const [genderPreference, setGenderPreference] = useState<GenderPreference>('all');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);

  useEffect(() => {
    if (!profile) return;
    setRelationshipGoal((profile.relationship_goal as RelationshipGoal) ?? 'both');
    setGenderPreference((profile.gender_preference as GenderPreference) ?? 'all');
    setBio(profile.bio ?? '');
    setInterests(profile.interests ?? []);
  }, [profile]);

  const toggleInterest = (tag: string) => {
    setInterests((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= 10) return prev;
      return [...prev, tag];
    });
  };

  const validate = useMemo(() => {
    if (bio.length > 500) return false;
    if (interests.length < 3 || interests.length > 10) return false;
    return true;
  }, [bio.length, interests.length]);

  const handleSave = async () => {
    if (!user || !profile) return;
    if (!validate) {
      if (bio.length > 500) {
        Alert.alert('Invalid', 'Bio must be at most 500 characters.');
        return;
      }
      Alert.alert('Invalid', 'Pick between 3 and 10 interests.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        bio: bio.trim() || null,
        relationship_goal: relationshipGoal,
        gender_preference: genderPreference,
        interests,
      };

      const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      await refreshProfile();
      Alert.alert('Saved', 'Your profile has been updated.');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save profile');
    } finally {
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Relationship goal</Text>
          <View style={styles.card}>
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
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Who do you want to match with?</Text>
          <View style={styles.card}>
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
          <Text style={styles.sectionTitle}>About you</Text>
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
                    style={[styles.chip, selected && styles.chipSelected]}
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

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <>
              <ActivityIndicator color="#FFFFFF" style={styles.buttonLoader} />
              <Text style={styles.saveButtonText}>Saving...</Text>
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
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 10,
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
  interestCounter: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  counterText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  saveButton: {
    marginTop: 10,
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
});
