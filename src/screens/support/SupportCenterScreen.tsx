import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, SafeAreaView, ScrollView } from 'react-native';

const SUPPORT_EMAIL = 'omutimahelpcenter@gmail.com';

export const SupportCenterScreen: React.FC = () => {
  const handleEmailPress = () => {
    const subject = encodeURIComponent('UMUTIMA Support Request');
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${subject}`;
    Linking.openURL(mailto).catch(() => {
      // silent fail; no alerts to keep UX simple
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Support Center</Text>
        <Text style={styles.subtitle}>We are here to help you with UMUTIMA.</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Contact us</Text>
          <Text style={styles.bodyText}>
            If you have any questions, issues, or feedback, you can reach our support team at:
          </Text>
          <TouchableOpacity onPress={handleEmailPress} activeOpacity={0.8} style={styles.emailButton}>
            <Text style={styles.emailText}>{SUPPORT_EMAIL}</Text>
          </TouchableOpacity>
          <Text style={styles.helperText}>
            Tapping the email will open your default mail app so you can send us a message.
          </Text>
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
    flexGrow: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 6,
    color: '#1A1A1A',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    color: '#1A1A1A',
  },
  bodyText: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 16,
    lineHeight: 20,
  },
  emailButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emailText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  helperText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
});
