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
  Modal,
  FlatList,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../context/AuthContext';
import { Gender } from '../../types/profile';
import { supabase } from '../../config/supabaseClient';

export type ProfileBasicInfoScreenProps = NativeStackScreenProps<RootStackParamList, 'ProfileBasicInfo'>;

export const ProfileBasicInfoScreen: React.FC<ProfileBasicInfoScreenProps> = ({ navigation }) => {
  const { user, profile, refreshProfile } = useAuth();

  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [dob, setDob] = useState<{ day: number; month: number; year: number } | null>(null);
  const [gender, setGender] = useState<Gender>('other');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  const [dobPickerOpen, setDobPickerOpen] = useState(false);
  const [dobPickerPart, setDobPickerPart] = useState<'day' | 'month' | 'year'>('day');

  const email = user?.email ?? '';

  const sanitizeLettersOnly = (value: string) => value.replace(/[^A-Za-z '\-]/g, '');

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

  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? '');
    setGender((profile.gender as Gender) ?? 'other');
    setCity(profile.city ?? '');
    setCountry(profile.country ?? '');

    const rawDob = (profile as any)?.date_of_birth as string | null | undefined;
    if (rawDob && /^\d{4}-\d{2}-\d{2}$/.test(rawDob)) {
      const [y, m, d] = rawDob.split('-').map((v) => Number(v));
      if (y && m && d) {
        setDob({ year: y, month: m, day: d });
      }
    }
  }, [profile]);

  const isValidName = useMemo(() => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    return /^[A-Za-z]+([ '\-][A-Za-z]+)*$/.test(trimmed);
  }, [name]);

  const validate = () => {
    if (!name.trim()) {
      Alert.alert('Invalid', 'Name is required.');
      return false;
    }
    if (!isValidName) {
      Alert.alert('Invalid', "Name must contain letters only. You can use spaces, hyphens, and apostrophes.");
      return false;
    }
    if (!dob || computedAge === null || computedAge < 18) {
      Alert.alert('Invalid', 'Please select a valid date of birth. You must be at least 18.');
      return false;
    }
    if (!city.trim() || !country.trim()) {
      Alert.alert('Invalid', 'City and country are required.');
      return false;
    }
    if (!/^[A-Za-z]+([ '\-][A-Za-z]+)*$/.test(city.trim())) {
      Alert.alert('Invalid', 'City must contain letters only.');
      return false;
    }
    if (!/^[A-Za-z]+([ '\-][A-Za-z]+)*$/.test(country.trim())) {
      Alert.alert('Invalid', 'Country must contain letters only.');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!user || !profile) return;
    if (!validate()) return;

    setSaving(true);
    try {
      if (!dobIso || computedAge === null) {
        Alert.alert('Invalid', 'Please select your date of birth.');
        return;
      }

      const payload = {
        name: name.trim(),
        age: computedAge,
        date_of_birth: dobIso,
        gender,
        city: city.trim(),
        country: country.trim(),
      };

      const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
      if (error) {
        const msg = String(error.message ?? '');
        if (msg.toLowerCase().includes('date_of_birth') || msg.toLowerCase().includes('column')) {
          const fallbackPayload = {
            name: name.trim(),
            age: computedAge,
            gender,
            city: city.trim(),
            country: country.trim(),
          };
          const { error: fallbackError } = await supabase
            .from('profiles')
            .update(fallbackPayload)
            .eq('id', user.id);
          if (fallbackError) {
            Alert.alert('Error', fallbackError.message);
            return;
          }
        } else {
          Alert.alert('Error', error.message);
          return;
        }
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
        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.readonlyBox}>
            <Text style={styles.readonlyText}>{email || '—'}</Text>
          </View>

          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(t) => setName(sanitizeLettersOnly(t))}
            placeholder="Enter your name"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.label}>Date of birth</Text>
          <TouchableOpacity
            style={[styles.input, styles.dobRow]}
            onPress={() => setDobPickerOpen(true)}
            activeOpacity={0.85}
          >
            <Text style={dob ? styles.dobText : styles.dobPlaceholder}>
              {dob
                ? `${String(dob.day).padStart(2, '0')}/${String(dob.month).padStart(2, '0')}/${dob.year}`
                : 'Select day / month / year'}
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
            onChangeText={(t) => setCity(sanitizeLettersOnly(t))}
            placeholder="Enter your city"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.label}>Country</Text>
          <TextInput
            style={styles.input}
            value={country}
            onChangeText={(t) => setCountry(sanitizeLettersOnly(t))}
            placeholder="Enter your country"
            placeholderTextColor="#9CA3AF"
          />
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

              <TouchableOpacity style={styles.modalDone} onPress={() => setDobPickerOpen(false)}>
                <Text style={styles.modalDoneText}>Done</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
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
  readonlyBox: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    backgroundColor: '#F3F4F6',
  },
  readonlyText: {
    fontSize: 15,
    color: '#1A1A1A',
    fontWeight: '600',
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
  saveButton: {
    marginTop: 16,
    backgroundColor: '#ff4b2b',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff4b2b',
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
