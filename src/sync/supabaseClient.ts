import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || (Constants as any).manifest?.extra || {};

const supabaseUrl = 
  process.env.EXPO_PUBLIC_SUPABASE_URL || 
  extra.supabaseUrl || 
  'https://urejmenobovrcefozziw.supabase.co';

const supabaseAnonKey = 
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
  extra.supabaseAnonKey || 
  'sb_publishable_CXo9xg2UxxdYsslpgyUNFA_Dq-tfAHT';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://placeholder.supabase.co'
);

// Provide clear warning if missing, but do not crash the app since it's offline-first
if (!isSupabaseConfigured) {
  console.warn(
    'Supabase configuration is missing. The app will run in local-only mode. ' +
    'Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file or app.json.'
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
