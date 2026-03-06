import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../context/AuthContext';

export type ProfileHubScreenProps = NativeStackScreenProps<RootStackParamList, 'MyProfile'>;

export const ProfileHubScreen: React.FC<ProfileHubScreenProps> = ({ navigation }) => {
  const { user, profile, signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          signOut().catch(() => {
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          });
        },
      },
    ]);
  };

  const displayName = profile?.name?.trim() || 'Your profile';
  const username = profile?.username ? `@${profile.username}` : null;
  const isVerified = !!profile?.is_verified;

  const avatarUri = profile?.photos?.[0] || null;

  const initials = (() => {
    const cleaned = displayName.replace(/\s+/g, ' ').trim();
    if (!cleaned || cleaned === 'Your profile') return 'U';
    const parts = cleaned.split(' ').filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const second = parts.length > 1 ? parts[1]?.[0] ?? '' : '';
    return (first + second).toUpperCase() || 'U';
  })();

  if (!user || !profile) {
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
          <View style={styles.avatarRing}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
          </View>

          <View style={styles.nameRow}>
            <Text style={styles.name}>{displayName}</Text>
            {isVerified ? (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            ) : null}
          </View>

          {username ? <Text style={styles.username}>{username}</Text> : null}
        </View>

        <View style={styles.group}>
          <TouchableOpacity
            style={styles.primaryItem}
            onPress={() => navigation.navigate('ProfileBasicInfo')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryItemTitle}>Basic information</Text>
            <Text style={styles.primaryItemSubtitle}>Name, email, age, gender, city, country</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryItem}
            onPress={() => navigation.navigate('ProfilePreferences')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryItemTitle}>Preferences</Text>
            <Text style={styles.primaryItemSubtitle}>Relationship goal, about you, interests</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryItem}
            onPress={() => navigation.navigate('ProfilePhotos')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryItemTitle}>Photos</Text>
            <Text style={styles.primaryItemSubtitle}>View and change your photos</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryItem}
            onPress={() => navigation.navigate('ProfileSupportPrivacy')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryItemTitle}>Support & privacy</Text>
            <Text style={styles.primaryItemSubtitle}>Support, policies, export, delete account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.group}>
          <TouchableOpacity
            style={styles.secondaryItem}
            onPress={() => navigation.navigate('RequestVerification')}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryItemText}>Request Verified Badge</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dangerItem} onPress={handleSignOut} activeOpacity={0.85}>
            <Text style={styles.dangerText}>Sign out</Text>
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
  empty: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
  },
  avatarRing: {
    width: 106,
    height: 106,
    borderRadius: 53,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F97316',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: '900',
    color: '#F97316',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  name: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },
  verifiedBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  verifiedText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  username: {
    marginTop: 4,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '700',
  },
  group: {
    marginTop: 12,
  },
  primaryItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  primaryItemTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 4,
  },
  primaryItemSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  secondaryItem: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  secondaryItemText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#2563EB',
  },
  dangerItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  dangerText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#EF4444',
  },
});
