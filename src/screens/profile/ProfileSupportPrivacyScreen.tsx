import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Share,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import * as FileSystem from 'expo-file-system';
import { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuth } from '../../context/AuthContext';
import { deleteMyAccount, requestMyDataExport } from '../../services/account';

export type ProfileSupportPrivacyScreenProps = NativeStackScreenProps<RootStackParamList, 'ProfileSupportPrivacy'>;

export const ProfileSupportPrivacyScreen: React.FC<ProfileSupportPrivacyScreenProps> = ({ navigation }) => {
  const { user } = useAuth();

  const [busy, setBusy] = useState(false);

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
              setBusy(true);
              await deleteMyAccount(user.id);
            } catch (e: any) {
              Alert.alert('Error', e?.message ?? 'Failed to delete account');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const handleExportMyData = async () => {
    if (!user) return;
    try {
      setBusy(true);
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
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.item}
            onPress={() => navigation.navigate('SupportCenter')}
            activeOpacity={0.8}
            disabled={busy}
          >
            <Text style={styles.itemText}>Support center</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.item}
            onPress={() => navigation.navigate('TermsOfService')}
            activeOpacity={0.8}
            disabled={busy}
          >
            <Text style={styles.itemText}>Terms of Service</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.item}
            onPress={() => navigation.navigate('PrivacyPolicy')}
            activeOpacity={0.8}
            disabled={busy}
          >
            <Text style={styles.itemText}>Privacy Policy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.item}
            onPress={handleExportMyData}
            activeOpacity={0.8}
            disabled={busy}
          >
            <Text style={styles.itemText}>Export my data</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.item, styles.dangerItem]}
            onPress={handleDeleteAccount}
            activeOpacity={0.8}
            disabled={busy}
          >
            <Text style={[styles.itemText, styles.dangerText]}>Delete my account</Text>
          </TouchableOpacity>
        </View>

        {busy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator color="#ff4b2b" />
            <Text style={styles.busyText}>Please wait...</Text>
          </View>
        ) : null}
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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  item: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  itemText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  dangerItem: {
    backgroundColor: '#FEF2F2',
  },
  dangerText: {
    color: '#B91C1C',
  },
  busyRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  busyText: {
    marginLeft: 8,
    color: '#6B7280',
    fontWeight: '700',
  },
});
