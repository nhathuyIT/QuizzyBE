import * as dotenv from 'dotenv';
import { hashSync } from 'bcryptjs';
import { MongoClient, ObjectId } from 'mongodb';

dotenv.config();

const mongoUri = (
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.DATABASE_URL ||
  ''
).trim();

const now = new Date();
const connectRetries = Number(process.env.SEED_CONNECT_RETRIES ?? 3);
const connectTimeoutMs = Number(process.env.SEED_CONNECT_TIMEOUT_MS ?? 10000);

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

async function clearCollections(client: MongoClient): Promise<void> {
  const db = client.db();
  const collections = [
    'users',
    'ai_sources',
    'ai_generation_jobs',
    'decks',
    'cards',
    'card_progress',
    'study_sessions',
    'card_reviews',
  ];

  for (const collectionName of collections) {
    const exists = await db.listCollections({ name: collectionName }).hasNext();
    if (!exists) {
      continue;
    }

    await db.collection(collectionName).deleteMany({});
    console.log(`Da xoa du lieu cu trong collection: ${collectionName}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNetworkSelectionError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('name' in error || 'message' in error) &&
    ((error as { name?: string }).name === 'MongoServerSelectionError' ||
      String((error as { message?: string }).message).includes(
        'ServerSelection',
      ) ||
      String((error as { message?: string }).message).includes('SSL routines'))
  );
}

async function connectWithRetry(client: MongoClient): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= connectRetries; attempt += 1) {
    try {
      console.log(`Dang ket noi MongoDB... lan ${attempt}/${connectRetries}`);
      await client.connect();
      return;
    } catch (error) {
      lastError = error;

      if (attempt === connectRetries || !isNetworkSelectionError(error)) {
        break;
      }

      console.log(
        'Chua ket noi duoc Atlas, thu lai sau 2 giay. Neu tiep tuc loi, hay kiem tra Network Access/IP whitelist.',
      );
      await sleep(2000);
    }
  }

  throw lastError;
}

function printConnectionHelp(error: unknown): void {
  if (!isNetworkSelectionError(error)) {
    return;
  }

  console.error(
    [
      '',
      'Goi y sua loi ket noi MongoDB Atlas:',
      '1. Vao MongoDB Atlas > Network Access > Add IP Address.',
      '2. Chon Add Current IP Address, hoac tam thoi dung 0.0.0.0/0 khi dev do an.',
      '3. Kiem tra username/password va database user co quyen readWrite.',
      '4. Dam bao URI trong .env khong co dau cach thua va dung dang mongodb+srv://...',
      '5. Neu dung mang truong/cong ty/VPN, thu doi mang vi TLS toi Atlas co the bi chan.',
      '',
    ].join('\n'),
  );
}

async function runSeed(): Promise<void> {
  if (!mongoUri) {
    throw new Error('Missing MONGODB_URI or MONGO_URI in .env');
  }

  const client = new MongoClient(mongoUri, {
    serverSelectionTimeoutMS: connectTimeoutMs,
    connectTimeoutMS: connectTimeoutMs,
    socketTimeoutMS: connectTimeoutMs,
  });

  try {
    console.log('Dang ket noi toi MongoDB de nap du lieu mau...');
    await connectWithRetry(client);
    const db = client.db();

    await clearCollections(client);

    console.log('Bat dau seed du lieu moi...');

    const studentId = new ObjectId();
    const teacherId = new ObjectId();
    const deckId = new ObjectId();
    const cardId1 = new ObjectId();
    const cardId2 = new ObjectId();
    const cardId3 = new ObjectId();
    const aiSourceId = new ObjectId();
    const aiJobId = new ObjectId();
    const studySessionId = new ObjectId();

    const passwordHash = hashSync('password123', 10);

    await db.collection('users').insertMany([
      {
        _id: studentId,
        email: 'student@gizmo.local',
        passwordHash,
        name: 'Nguyen Huy Hoc Vien',
        role: 'student',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Student',
        totalPoints: 120,
        streak: {
          current: 3,
          longest: 7,
          lastActive: now,
        },
        preferences: {
          theme: 'dark',
          language: 'vi',
        },
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: teacherId,
        email: 'teacher@gizmo.local',
        passwordHash,
        name: 'Thay Giao AI',
        role: 'teacher',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Teacher',
        totalPoints: 0,
        streak: {
          current: 0,
          longest: 0,
        },
        preferences: {
          theme: 'light',
          language: 'vi',
        },
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    console.log('Da tao users mau.');

    await db.collection('decks').insertOne({
      _id: deckId,
      title: 'Tu vung IELTS Cong Nghe Thong Tin',
      description: 'Bo the mau ve chu de Tech & AI.',
      visibility: 'public',
      createdBy: studentId,
      sourceType: 'ai',
      tags: ['IELTS', 'Tech', 'AI', 'Vocab'],
      cardCount: 3,
      lastStudiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    console.log('Da tao deck mau.');

    await db.collection('ai_sources').insertOne({
      _id: aiSourceId,
      userId: studentId,
      type: 'text',
      title: 'Tech vocabulary source',
      rawText:
        'Meticulous, ephemeral, and ubiquitous are useful academic words in technology contexts.',
      extractedText:
        'Meticulous, ephemeral, and ubiquitous are useful academic words in technology contexts.',
      status: 'parsed',
      createdAt: now,
      updatedAt: now,
    });

    await db.collection('ai_generation_jobs').insertOne({
      _id: aiJobId,
      userId: studentId,
      sourceId: aiSourceId,
      targetDeckId: deckId,
      status: 'done',
      prompt:
        'Generate 3 Vietnamese flashcards for IELTS technology vocabulary.',
      options: {
        cardCount: 3,
        difficulty: 'medium',
        language: 'vi',
      },
      usage: {
        inputTokens: 120,
        outputTokens: 260,
      },
      finishedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    console.log('Da tao AI source va AI job mau.');

    await db.collection('cards').insertMany([
      {
        _id: cardId1,
        deckId,
        front: 'Meticulous',
        back: 'Ti mi, ky cang',
        hint: 'Very careful and precise',
        explanation:
          'Thuong dung khi mo ta viec kiem thu phan mem hoac viet code can than.',
        imageUrl: '',
        examples: ['A meticulous developer checks edge cases before release.'],
        position: 0,
        aiJobId,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: cardId2,
        deckId,
        front: 'Ephemeral',
        back: 'Phu du, ton tai trong thoi gian ngan',
        hint: 'Short-lived',
        explanation:
          'Co the dung de mo ta du lieu session hoac cache ton tai tam thoi.',
        imageUrl: '',
        examples: ['Ephemeral data disappears after the session ends.'],
        position: 1,
        aiJobId,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: cardId3,
        deckId,
        front: 'Ubiquitous',
        back: 'Pho bien khap noi',
        hint: 'Everywhere',
        explanation:
          'Internet va smartphone la vi du cua ubiquitous technology.',
        imageUrl: '',
        examples: ['Cloud services are becoming ubiquitous in modern apps.'],
        position: 2,
        aiJobId,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    console.log('Da tao cards mau.');

    await db.collection('card_progress').insertMany([
      {
        userId: studentId,
        cardId: cardId1,
        deckId,
        mastery: 20,
        status: 'learning',
        easeFactor: 2.5,
        intervalDays: 1,
        dueAt: addDays(now, 1),
        correctCount: 1,
        wrongCount: 2,
        createdAt: now,
        updatedAt: now,
      },
      {
        userId: studentId,
        cardId: cardId2,
        deckId,
        mastery: 80,
        status: 'mastered',
        easeFactor: 2.6,
        intervalDays: 7,
        dueAt: addDays(now, 7),
        correctCount: 5,
        wrongCount: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        userId: studentId,
        cardId: cardId3,
        deckId,
        mastery: 0,
        status: 'review',
        easeFactor: 1.7,
        intervalDays: 0,
        dueAt: addDays(now, -1),
        correctCount: 0,
        wrongCount: 3,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    console.log('Da tao card progress mau.');

    await db.collection('study_sessions').insertOne({
      _id: studySessionId,
      userId: studentId,
      deckId,
      mode: 'flashcard',
      finishedAt: now,
      stats: {
        correct: 2,
        wrong: 1,
        skipped: 0,
        timeSpentSec: 120,
      },
      startedAt: addDays(now, 0),
    });

    await db.collection('card_reviews').insertMany([
      {
        sessionId: studySessionId,
        userId: studentId,
        cardId: cardId1,
        answer: 'Ti mi',
        isCorrect: true,
        rating: 'good',
        responseTimeMs: 3200,
        createdAt: now,
      },
      {
        sessionId: studySessionId,
        userId: studentId,
        cardId: cardId3,
        answer: 'Pho bien',
        isCorrect: false,
        rating: 'again',
        responseTimeMs: 5100,
        createdAt: now,
      },
    ]);
    console.log('Da tao study session va card reviews mau.');

    console.log('Seed du lieu thanh cong.');
  } finally {
    await client.close();
    console.log('Da ngat ket noi MongoDB.');
  }
}

void runSeed().catch((error) => {
  printConnectionHelp(error);
  console.error('Seed du lieu that bai:', error);
  process.exit(1);
});
