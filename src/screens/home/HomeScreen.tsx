import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { signOut, user, profile } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Uni Dating Beta</Text>
      <Text style={styles.beta}>BETA</Text>
      <Text style={styles.subtitle}>Welcome, {profile?.name || user?.email}!</Text>
      <Text style={styles.subtitle}>This is a minimal placeholder home screen.</Text>

      <View style={styles.buttonRow}>
        <Button
          title="Browse matches (Beta)"
          onPress={() => navigation.navigate('Discovery')}
        />
      </View>

      <View style={styles.buttonRow}>
        <Button
          title="Messages (Beta)"
          onPress={() => navigation.navigate('Matches')}
        />
      </View>

      <View style={styles.buttonRow}>
        <Button title="Sign out" onPress={signOut} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  beta: {
    fontSize: 12,
    color: '#ef4444',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  buttonRow: {
    marginTop: 12,
  },
});
