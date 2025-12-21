import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Alert } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../config/supabaseClient';
import { Profile } from '../types/profile';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  profile: Profile | null;
  profileLoading: boolean;
  signUpWithEmailPassword: (email: string, password: string, username: string) => Promise<void>;
  signInWithUsernamePassword: (username: string, password: string) => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('Error getting session', error.message);
      }
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      setLoading(false);
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (!newSession) {
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const refreshProfile = async () => {
    if (!user) return;
    setProfileLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      // eslint-disable-next-line no-console
      console.warn('Error loading profile', error.message);
    }

    setProfile((data as Profile) ?? null);
    setProfileLoading(false);
  };

  const signUpWithEmailPassword = async (email: string, password: string, username: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        },
      },
    });

    if (error) {
      Alert.alert('Sign-up error', error.message);
      throw error;
    }

    // Also persist the username into the profiles table so username-based login can look it up.
    // We match on email here since handle_new_user has already created the minimal profile row.
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ username })
      .eq('email', email);

    if (profileError) {
      // eslint-disable-next-line no-console
      console.warn('Error updating profile username during sign up', profileError.message);
    }

    Alert.alert('Account created', 'Your account has been created. You can now sign in.');
  };

  const signInWithUsernamePassword = async (username: string, password: string) => {
    // Look up the user's email by username in the profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('username', username)
      .maybeSingle();

    if (profileError) {
      Alert.alert('Sign-in error', profileError.message);
      throw profileError;
    }

    if (!profile || !profile.email) {
      Alert.alert('Sign-in error', 'User not found. Please check your username.');
      throw new Error('User not found');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password,
    });

    if (error) {
      Alert.alert('Sign-in error', error.message);
      throw error;
    }
    setSession(data.session ?? null);
    setUser(data.user ?? null);
  };

  const resetPasswordForEmail = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      Alert.alert('Password reset error', error.message);
      throw error;
    }

    Alert.alert(
      'Password reset email sent',
      'If an account exists for this email, you will receive instructions to reset your password.'
    );
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        profile,
        profileLoading,
        signUpWithEmailPassword,
        signInWithUsernamePassword,
        resetPasswordForEmail,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
