import { migrateLegacyDataIfNeeded } from './legacyMigration';


// Mock dependencies
const mockDb = {
  getFirstAsync: async (query: string) => {
    if (query.includes('legacy_migration_status')) {
      return { value: 'completed' }; // Simulate already completed
    }
    return null;
  },
  runAsync: async () => {},
  withExclusiveTransactionAsync: async (cb: any) => await cb(mockDb)
};

async function runTest() {
  let logCalled = false;
  const originalLog = console.log;
  console.log = (msg: string) => {
    if (msg.includes('Starting legacy AsyncStorage to SQLite migration...')) {
      logCalled = true;
    }
  };

  try {
    await migrateLegacyDataIfNeeded(mockDb as any);
    if (logCalled !== false) {
      throw new Error('Migration should exit early if marked completed');
    }
    originalLog('Migration Test Passed: exits early if migration is already marked completed');
  } finally {
    console.log = originalLog;
  }
}

runTest().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
