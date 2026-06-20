import * as dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config();

const mongoUri = (
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.DATABASE_URL ||
  ''
).trim();

async function run(): Promise<void> {
  if (!mongoUri) {
    throw new Error('Missing MONGODB_URI or MONGO_URI in .env');
  }

  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const db = client.db();

    const [users, tokenVersions, decks] = await Promise.all([
      db
        .collection('users')
        .updateMany(
          { status: { $exists: false } },
          { $set: { status: 'active' } },
        ),
      db
        .collection('users')
        .updateMany(
          { tokenVersion: { $exists: false } },
          { $set: { tokenVersion: 0 } },
        ),
      db
        .collection('decks')
        .updateMany(
          { moderationStatus: { $exists: false } },
          { $set: { moderationStatus: 'active' } },
        ),
    ]);

    await Promise.all([
      db.collection('users').createIndex({ role: 1, status: 1, createdAt: -1 }),
      db.collection('users').createIndex({ isDeleted: 1, createdAt: -1 }),
      db
        .collection('decks')
        .createIndex({ moderationStatus: 1, visibility: 1, createdAt: -1 }),
      db
        .collection('decks')
        .createIndex({ createdBy: 1, deletedAt: 1, updatedAt: -1 }),
      db
        .collection('study_sessions')
        .createIndex({ startedAt: -1, mode: 1, finishedAt: 1 }),
      db.collection('study_sessions').createIndex({ userId: 1, startedAt: -1 }),
      db
        .collection('card_reviews')
        .createIndex({ createdAt: -1, userId: 1, isCorrect: 1 }),
      db
        .collection('admin_audit_logs')
        .createIndex({ createdAt: -1, action: 1 }),
      db
        .collection('admin_audit_logs')
        .createIndex({ targetType: 1, targetId: 1, createdAt: -1 }),
    ]);

    console.log(
      `Admin V1 backfill complete: ${users.modifiedCount} users, ${tokenVersions.modifiedCount} token versions, ${decks.modifiedCount} decks.`,
    );
  } finally {
    await client.close();
  }
}

void run().catch((error) => {
  console.error('Admin V1 backfill failed:', error);
  process.exit(1);
});
