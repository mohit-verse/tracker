import { supabase } from '../supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import { processOutbox, pullRemoteChanges } from '../syncService';
import { getDatabase } from '../../db';
import { enqueueOutboxOperation } from '../../db/outbox';

async function runLiveIntegrationTest() {
  console.log('--- Phase 5.3 Live Integration Test Harness ---');

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const testUserEmail = process.env.TEST_USER_EMAIL || 'test@example.com';
  const testUserPassword = process.env.TEST_USER_PASSWORD || 'password123';

  if (!supabaseUrl || !anonKey) {
    console.error('❌ Integration Test Blocker: EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is missing.');
    console.log('Test harness is ready. Please configure a dedicated Supabase project with these variables and run this script again.');
    process.exit(1);
  }

  console.log('1. Environment verified. Connecting to Supabase...');

  // Ensure DB is initialized
  const db = await getDatabase();

  // 2. Authentication
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: testUserEmail,
    password: testUserPassword
  });

  if (authError || !authData.user) {
    console.error('❌ Failed to authenticate test user:', authError?.message || 'No user');
    process.exit(1);
  }

  console.log(`✅ Authenticated successfully as ${authData?.user?.id}`);

  try {
    // 3. Clean state (mock local wipe)
    await db.runAsync('DELETE FROM sync_outbox');
    await db.runAsync('DELETE FROM subjects');
    await db.runAsync('DELETE FROM semesters');

    // 4. Test Scenario: Offline create and update, then sync
    const semesterId = uuidv4();
    const subjectId = uuidv4();
    const now = new Date().toISOString();

    await db.withExclusiveTransactionAsync(async (tx) => {
      // Semester
      await tx.runAsync('INSERT INTO semesters (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', 
        [semesterId, 'Integration Test Semester', now, now]);
      await enqueueOutboxOperation(tx, 'INSERT', 'semesters', semesterId);

      // Subject
      await tx.runAsync('INSERT INTO subjects (id, semester_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', 
        [subjectId, semesterId, 'Integration Test Subject', now, now]);
      await enqueueOutboxOperation(tx, 'INSERT', 'subjects', subjectId);
    });

    console.log('Queued local mutations. Triggering sync...');
    await processOutbox();

    // Verify remote
    const { data: remoteSubjects, error: remoteError } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', subjectId);

    if (remoteError || !remoteSubjects || remoteSubjects.length !== 1) {
      throw new Error('Failed to push to remote.');
    }
    console.log('✅ Outbox successfully propagated to Supabase.');

    // 5. Test Scenario: Remote deletion (tombstone) & subsequent pull
    const futureDate = new Date(Date.now() + 60000).toISOString();
    await supabase.from('subjects').delete().eq('id', subjectId);
    await supabase.rpc('sync_upsert', {
       p_table_name: 'deleted_records',
       p_payload: { id: subjectId, table_name: 'subjects', deleted_at: futureDate }
    });
    
    console.log('Triggering Pull...');
    await pullRemoteChanges();

    const localSubjectCheck = await db.getFirstAsync('SELECT * FROM subjects WHERE id = ?', [subjectId]);
    if (localSubjectCheck) {
      throw new Error('Tombstone pull failed to delete local row.');
    }
    console.log('✅ Tombstone successfully synchronized and converged local state.');

  } catch (err: any) {
    console.error('❌ Integration Test Failed:', err.message);
  } finally {
    // Sign out
    await supabase.auth.signOut();
  }
}

runLiveIntegrationTest().catch(err => {
  console.error(err);
  process.exit(1);
});
