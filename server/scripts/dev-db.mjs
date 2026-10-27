// Local development database: a single-node MongoDB replica set (supports
// transactions) via mongodb-memory-server, persisted under server/.dev-db so
// data survives restarts. For production use MongoDB Atlas (see README).
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const port = Number(process.env.DEV_DB_PORT ?? 27018);
const dbPath = fileURLToPath(new URL('../.dev-db', import.meta.url));
mkdirSync(dbPath, { recursive: true });
const replSet = await MongoMemoryReplSet.create({
  replSet: { count: 1, storageEngine: 'wiredTiger' },
  instanceOpts: [{ port, dbPath }],
});
console.log(`Dev MongoDB ready: ${replSet.getUri('nutritrack')}`);
console.log('Set MONGODB_URI in server/.env to the URI above. Press Ctrl+C to stop.');

const stop = async () => {
  await replSet.stop({ doCleanup: false });
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);


GtFmA80yYNLzG4tg
parth_nutritrack