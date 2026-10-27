// Throwaway in-memory replica set for end-to-end tests (no data persisted).
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const port = Number(process.env.E2E_DB_PORT ?? 27019);
const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' }, instanceOpts: [{ port }] });
console.log(`E2E MongoDB ready: ${replSet.getUri('nutritrack_e2e')}`);
const stop = async () => {
  await replSet.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
