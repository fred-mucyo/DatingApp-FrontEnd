import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Image,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../context/AuthContext';

type VerificationStatus = 'pending' | 'approved' | 'rejected';

type VerificationRequest = {
  id: string;
  user_id: string;
  legal_name: string;
  document_type: string;
  status: VerificationStatus;
  review_notes: string | null;
  id_front_path: string;
  id_back_path: string | null;
  selfie_path: string | null;
  created_at: string;
  reviewed_at: string | null;
};

const BUCKET = 'verification-docs';

export const RequestVerificationScreen: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [existing, setExisting] = useState<VerificationRequest | null>(null);

  const [legalName, setLegalName] = useState('');
  const [documentType, setDocumentType] = useState<'national_id' | 'passport' | 'drivers_license' | 'other'>('national_id');

  const [idFrontUri, setIdFrontUri] = useState<string | null>(null);
  const [idBackUri, setIdBackUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return !!user && legalName.trim().length >= 2 && !!idFrontUri;
  }, [user, legalName, idFrontUri]);

  const loadLatest = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('verification_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        Alert.alert('Error', error.message);
        return;
      }

      setExisting((data as VerificationRequest) ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (profile?.name && !legalName) {
      // prefill, but user can edit. Legal name stays private.
      setLegalName(profile.name);
    }
  }, [profile?.name, legalName]);

  const pickImage = async (setter: (uri: string) => void) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'We need access to your photos to upload.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setter(result.assets[0].uri);
    }
  };

  const uploadToBucket = async (requestId: string, localUri: string, fileName: string) => {
    if (!user) throw new Error('Not authenticated');

    const path = `${user.id}/${requestId}/${fileName}`;

    const res = await fetch(localUri);
    const blob = await res.blob();

    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      upsert: true,
      contentType: blob.type || 'image/jpeg',
    });

    if (error) throw new Error(error.message);

    return path;
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!canSubmit) {
      Alert.alert('Incomplete', 'Please enter your legal name and upload your ID front image.');
      return;
    }

    setSubmitting(true);
    try {
      // Create request row first with temporary paths; we will update after uploads.
      const { data: inserted, error: insertError } = await supabase
        .from('verification_requests')
        .insert({
          user_id: user.id,
          legal_name: legalName.trim(),
          document_type: documentType,
          status: 'pending',
          review_notes: null,
          id_front_path: 'pending',
          id_back_path: null,
          selfie_path: null,
          // retention from submission until reviewed
          documents_delete_after: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select('*')
        .single();

      if (insertError) {
        Alert.alert('Error', insertError.message);
        return;
      }

      const request = inserted as VerificationRequest;

      const frontPath = await uploadToBucket(request.id, idFrontUri as string, 'id-front.jpg');
      const backPath = idBackUri ? await uploadToBucket(request.id, idBackUri, 'id-back.jpg') : null;
      const selfiePath = selfieUri ? await uploadToBucket(request.id, selfieUri, 'selfie.jpg') : null;

      const { error: updateError } = await supabase
        .from('verification_requests')
        .update({
          id_front_path: frontPath,
          id_back_path: backPath,
          selfie_path: selfiePath,
        })
        .eq('id', request.id);

      if (updateError) {
        Alert.alert('Error', updateError.message);
        return;
      }

      await loadLatest();
      await refreshProfile();
      Alert.alert('Submitted', 'Your verification request has been submitted for review.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const statusLabel = (s: VerificationStatus) => {
    switch (s) {
      case 'pending':
        return 'Pending review';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      default:
        return s;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#F97316" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Verification</Text>
        <Text style={styles.subtitle}>
          Submit your legal name and identity documents for review. Your legal name stays private and is used only for verification.
        </Text>

        {existing && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Current status</Text>
            <Text style={styles.statusText}>{statusLabel(existing.status)}</Text>
            {existing.status === 'rejected' && !!existing.review_notes && (
              <View style={styles.notesBox}>
                <Text style={styles.notesTitle}>Review notes</Text>
                <Text style={styles.notesText}>{existing.review_notes}</Text>
              </View>
            )}
            {existing.status === 'approved' && (
              <Text style={styles.approvedHelper}>You are verified ✓</Text>
            )}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Request verification</Text>

          <Text style={styles.label}>Legal name (private)</Text>
          <TextInput
            style={styles.input}
            value={legalName}
            onChangeText={setLegalName}
            placeholder="Your legal name"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.label}>Document type</Text>
          <View style={styles.row}>
            {([
              ['national_id', 'National ID'],
              ['passport', 'Passport'],
              ['drivers_license', 'Driver\'s license'],
              ['other', 'Other'],
            ] as const).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                style={[styles.chip, documentType === key && styles.chipSelected]}
                onPress={() => setDocumentType(key)}
                activeOpacity={0.8}
                disabled={submitting}
              >
                <Text style={documentType === key ? styles.chipTextSelected : styles.chipText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>ID front (required)</Text>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={() => pickImage((uri) => setIdFrontUri(uri))}
            activeOpacity={0.85}
            disabled={submitting}
          >
            <Text style={styles.uploadButtonText}>{idFrontUri ? 'Change photo' : 'Upload photo'}</Text>
          </TouchableOpacity>
          {idFrontUri ? <Image source={{ uri: idFrontUri }} style={styles.preview} /> : null}

          <Text style={styles.label}>ID back (optional)</Text>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={() => pickImage((uri) => setIdBackUri(uri))}
            activeOpacity={0.85}
            disabled={submitting}
          >
            <Text style={styles.uploadButtonText}>{idBackUri ? 'Change photo' : 'Upload photo'}</Text>
          </TouchableOpacity>
          {idBackUri ? <Image source={{ uri: idBackUri }} style={styles.preview} /> : null}

          <Text style={styles.label}>Selfie holding ID (optional)</Text>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={() => pickImage((uri) => setSelfieUri(uri))}
            activeOpacity={0.85}
            disabled={submitting}
          >
            <Text style={styles.uploadButtonText}>{selfieUri ? 'Change photo' : 'Upload photo'}</Text>
          </TouchableOpacity>
          {selfieUri ? <Image source={{ uri: selfieUri }} style={styles.preview} /> : null}

          <TouchableOpacity
            style={[styles.submitButton, (!canSubmit || submitting) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.9}
            disabled={!canSubmit || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Submit request</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFAFA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#6B7280', lineHeight: 18, textAlign: 'center', marginBottom: 18 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 8 },
  statusText: { fontSize: 14, fontWeight: '700', color: '#F97316' },
  approvedHelper: { marginTop: 6, fontSize: 13, color: '#10B981', fontWeight: '700' },
  notesBox: { marginTop: 10, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  notesTitle: { fontSize: 13, fontWeight: '800', color: '#111827', marginBottom: 6 },
  notesText: { fontSize: 13, color: '#4B5563', lineHeight: 18 },
  label: { marginTop: 10, marginBottom: 8, fontSize: 13, fontWeight: '800', color: '#111827' },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  chipSelected: { backgroundColor: '#F97316', borderColor: '#F97316' },
  chipText: { fontSize: 12, color: '#374151', fontWeight: '700' },
  chipTextSelected: { fontSize: 12, color: '#FFFFFF', fontWeight: '800' },
  uploadButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  uploadButtonText: { fontSize: 13, fontWeight: '800', color: '#111827' },
  preview: { width: '100%', height: 180, borderRadius: 12, marginTop: 10, backgroundColor: '#E5E7EB' },
  submitButton: {
    marginTop: 14,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
