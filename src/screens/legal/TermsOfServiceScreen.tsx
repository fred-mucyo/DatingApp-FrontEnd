import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/RootNavigator';

export type TermsOfServiceScreenProps = NativeStackScreenProps<RootStackParamList, 'TermsOfService'>;

export const TermsOfServiceScreen: React.FC<TermsOfServiceScreenProps> = () => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.updatedAt}>Last updated: {new Date().toISOString().substring(0, 10)}</Text>

        <View style={styles.card}>
          <Text style={styles.h2}>1. Overview</Text>
          <Text style={styles.p}>
            Mutima is a social and dating platform. By using the app you agree to these Terms.
          </Text>

          <Text style={styles.h2}>2. Eligibility</Text>
          <Text style={styles.p}>
            You must be at least 18 years old to use Mutima.
          </Text>

          <Text style={styles.h2}>3. Safety</Text>
          <Text style={styles.p}>
            Do not share sensitive information. Report abusive behavior using the in-app report feature.
          </Text>

          <Text style={styles.h2}>4. User Content</Text>
          <Text style={styles.p}>
            You are responsible for content you upload (photos, bio, messages). You agree not to post illegal,
            harmful, harassing, or infringing content.
          </Text>

          <Text style={styles.h2}>5. Account</Text>
          <Text style={styles.p}>
            You are responsible for keeping your login credentials secure. You can request deletion of your account
            in the app.
          </Text>

          <Text style={styles.h2}>6. Termination</Text>
          <Text style={styles.p}>
            We may suspend or terminate accounts that violate these Terms.
          </Text>

          <Text style={styles.h2}>7. Contact</Text>
          <Text style={styles.p}>
            For support, use the Support Center in the app.
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
