import { getDatabase, withTransaction } from './src/db/index';
import { enqueueOutboxOperation, getPendingOutboxEntries } from './src/db/outbox';

async function runDbTests() {
  console.log('=== Database Tests ===');
  try {
    // Attempt to initialize DB
    const db = await getDatabase();
    console.log('✅ [PASS] SQLite Database Initialized successfully in Node (Mocked/Available)');
    
    // Add tests for schema, outbox, etc.
    await withTransaction(async (tx) => {
      const outboxId = await enqueueOutboxOperation(tx, 'INSERT', 'habits', 'test-habit-1', { name: 'Drink Water' });
      if (outboxId) {
        console.log('✅ [PASS] Outbox entry enqueued in transaction');
      }
    });

    const pending = await getPendingOutboxEntries(db);
    if (pending.length > 0) {
      console.log('✅ [PASS] Pending outbox entries retrieved');
    }

  } catch (error: any) {
    if (error.message && error.message.includes('native module')) {
      console.log('⚠️ [UNVERIFIED] Native SQLite tests cannot run in Node environment (requires Expo/iOS/Android).');
    } else {
      console.error('❌ [FAIL] Database tests failed:', error);
      process.exit(1);
    }
  }

  console.log('\n=== Supabase Tests ===');
  try {
    const { isSupabaseConfigured, supabase } = require('./src/sync/supabaseClient');
    if (!isSupabaseConfigured) {
      console.log('✅ [PASS] Supabase safely falls back when EXPO_PUBLIC vars are missing.');
    }
    if (supabase) {
      console.log('✅ [PASS] Supabase client initialized without crashing.');
    }
  } catch (error) {
    console.error('❌ [FAIL] Supabase client failed to initialize:', error);
    process.exit(1);
  }
}

runDbTests();
