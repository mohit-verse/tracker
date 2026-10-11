import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../sync/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { getDatabase } from '../db';
import { AppState, Alert } from 'react-native';

import { isSetupComplete } from '../features/setup/setupDomain';

interface AuthContextType {
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  logout: () => Promise<void>;
  ownerError: string | null;
  hasSetup: boolean;
  checkSetup: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  loading: true,
  isConfigured: false,
  logout: async () => {},
  ownerError: null,
  hasSetup: false,
  checkSetup: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [hasSetup, setHasSetup] = useState(false);

  const checkSetupStatus = async (): Promise<void> => {
    try {
      const db = await getDatabase();
      
      // 1. Check explicit completion flag
      const meta = await db.getFirstAsync<{ value: string }>(
        `SELECT value FROM local_metadata WHERE key = 'setup_completed'`
      );
      if (meta?.value === '1') {
        setHasSetup(true);
        return;
      }

      // 2. Validate required entities
      const semester = await db.getFirstAsync<any>(
        `SELECT id, name, start_date FROM semesters WHERE is_active = 1`
      );
      const subject = await db.getFirstAsync<any>(
        `SELECT id FROM subjects LIMIT 1`
      );
      const timetable = await db.getFirstAsync<any>(
        `SELECT id FROM timetable_rules LIMIT 1`
      );

      const complete = isSetupComplete({
        metadataSetupCompleted: meta?.value,
        activeSemester: semester,
        subjectsCount: subject ? 1 : 0,
        timetableRulesCount: timetable ? 1 : 0,
      });

      setHasSetup(complete);
      if (complete) {
        await db.runAsync(`INSERT OR REPLACE INTO local_metadata (key, value) VALUES ('setup_completed', '1')`);
      }
    } catch (e) {
      console.warn('Error checking setup status:', e);
      setHasSetup(false);
    }
  };

  const checkOwnership = async (userId: string) => {
    try {
      const db = await getDatabase();
      const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM local_metadata WHERE key = 'owner_id'`);
      if (row && row.value) {
        if (row.value !== userId) {
          setOwnerError('This installation belongs to another account. You must sign out or reset local data to switch accounts safely.');
          return false;
        }
      } else {
        // Claim ownership
        await db.runAsync(`INSERT OR REPLACE INTO local_metadata (key, value) VALUES ('owner_id', ?)`, [userId]);
      }
      setOwnerError(null);
      await checkSetupStatus();
      return true;
    } catch (e) {
      console.warn('Ownership check failed', e);
      return false;
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      checkSetupStatus().then(() => setLoading(false));
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        checkOwnership(session.user.id).then((valid) => {
          if (valid) setSession(session);
          setLoading(false);
        });
      } else {
        setSession(null);
        checkSetupStatus().then(() => setLoading(false));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (newSession) {
        const valid = await checkOwnership(newSession.user.id);
        if (valid) setSession(newSession);
      } else {
        setSession(null);
        await checkSetupStatus();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle app state changes for token refresh
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });
    return () => sub.remove();
  }, []);

  const logout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
  };

  return (
    <AuthContext.Provider value={{ session, loading, isConfigured: isSupabaseConfigured, logout, ownerError, hasSetup, checkSetup: checkSetupStatus }}>
      {children}
    </AuthContext.Provider>
  );
};
