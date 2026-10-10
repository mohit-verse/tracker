import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { processOutbox, pullRemoteChanges } from './syncService';
import { getDatabase } from '../db';


export type SyncState = 'Synced' | 'Waiting for internet' | 'Syncing' | 'Sync failed' | 'Authentication required';

export const useSync = () => {
  const [syncState, setSyncState] = useState<SyncState>('Authentication required');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [outboxCount, setOutboxCount] = useState(0);

  const checkStatus = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setSyncState('Authentication required');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setIsAuthenticated(false);
      setUserEmail(null);
      setSyncState('Authentication required');
      return;
    }

    setIsAuthenticated(true);
    setUserEmail(session.user.email || 'User');

    // NetInfo not in dependencies, skip offline check for now
    // We just rely on sync succeeding or failing.
    // Check outbox
    const db = await getDatabase();
    const countResult = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM sync_outbox WHERE status != 'failed' OR retry_count < 5`);
    const count = countResult?.count || 0;
    setOutboxCount(count);

    if (count === 0) {
      setSyncState('Synced');
    } else {
      setSyncState('Sync failed'); // Will update when sync runs
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      checkStatus();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [checkStatus]);

  const syncNow = useCallback(async () => {
    if (syncState === 'Authentication required' || syncState === 'Waiting for internet') return;

    setSyncState('Syncing');
    try {
      await pullRemoteChanges();
      await processOutbox();
      await checkStatus();
    } catch (e) {
      console.error('Manual sync failed:', e);
      setSyncState('Sync failed');
    }
  }, [syncState, checkStatus]);

  return {
    syncState,
    isAuthenticated,
    userEmail,
    outboxCount,
    syncNow,
    checkStatus
  };
};
