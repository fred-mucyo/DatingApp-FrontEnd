import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';

export type PrivacyPolicyScreenProps = NativeStackScreenProps<RootStackParamList, 'PrivacyPolicy'>;

export const PrivacyPolicyScreen: React.FC<PrivacyPolicyScreenProps> = () => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.updatedAt}>Last updated: {new Date().toISOString().substring(0, 10)}</Text>

        <View style={styles.card}>
          <Text style={styles.h2}>1. Data we collect</Text>
          <Text style={styles.p}>
            We collect account information (email/username), profile information (name, age, gender, location, bio,
            interests, photos), and messages you send in the app.
          </Text>

          <Text style={styles.h2}>2. How we use data</Text>
          <Text style={styles.p}>
            We use your data to provide matching, messaging, safety features (blocking/reporting), and to improve
            the app.
          </Text>

          <Text style={styles.h2}>3. Sharing</Text>
          <Text style={styles.p}>
            We do not sell your personal data. We may share data with service providers needed to operate the app
            (e.g., hosting/storage) and when required by law.
          </Text>

          <Text style={styles.h2}>4. Security</Text>
          <Text style={styles.p}>
            We take reasonable measures to protect your data, but no method of transmission or storage is 100%
            secure.
          </Text>

          <Text style={styles.h2}>5. Your choices</Text>
          <Text style={styles.p}>
            You can update your profile, block/report users, and request account deletion in the app.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  updatedAt: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  h2: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginTop: 10,
    marginBottom: 6,
  },
  p: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
});
