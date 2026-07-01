import * as dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';

dotenv.config();

const mongoUri = (
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.DATABASE_URL ||
  ''
).trim();

const departments = [
  { code: 'AI', name: 'Artificial Intelligence' },
  { code: 'SE', name: 'Software Engineering' },
];

const subjects = [
  {
    code: 'PRF192',
    name: 'Programming Fundamentals',
    department: 'AI',
    semester: 1,
  },
  {
    code: 'MAE101',
    name: 'Mathematics for Engineering',
    department: 'AI',
    semester: 1,
  },
  {
    code: 'CEA201',
    name: 'Computer Organization and Architecture',
    department: 'AI',
    semester: 2,
  },
  {
    code: 'MAD101',
    name: 'Discrete Mathematics',
    department: 'AI',
    semester: 2,
  },
  {
    code: 'PRO192',
    name: 'Object-Oriented Programming',
    department: 'AI',
    semester: 3,
  },
  {
    code: 'AIE301M',
    name: 'Artificial Intelligence',
    department: 'AI',
    semester: 5,
  },
  {
    code: 'AIM301M',
    name: 'Applied Machine Learning',
    department: 'AI',
    semester: 6,
  },
  {
    code: 'PRF192',
    name: 'Programming Fundamentals',
    department: 'SE',
    semester: 1,
  },
  {
    code: 'MAE101',
    name: 'Mathematics for Engineering',
    department: 'SE',
    semester: 1,
  },
  {
    code: 'SWP391',
    name: 'Application Development Project',
    department: 'SE',
    semester: 5,
  },
  {
    code: 'SWD392',
    name: 'SW Architecture and Design',
    department: 'SE',
    semester: 6,
  },
];

async function ensureIndexes(client: MongoClient) {
  const db = client.db();

  await Promise.all([
    db.collection('departments').createIndex({ code: 1 }, { unique: true }),
    db
      .collection('subjects')
      .createIndex({ code: 1, departmentId: 1 }, { unique: true }),
    db.collection('subjects').createIndex({ departmentId: 1, semester: 1 }),
    db
      .collection('academic_documents')
      .createIndex({ subjectId: 1, createdAt: -1 }),
    db
      .collection('academic_documents')
      .createIndex({ uploadedBy: 1, createdAt: -1 }),
  ]);
}

async function runSeed() {
  if (!mongoUri) {
    throw new Error('Missing MONGODB_URI or MONGO_URI in .env');
  }

  const client = new MongoClient(mongoUri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
  const now = new Date();

  try {
    await client.connect();
    await ensureIndexes(client);

    const db = client.db();
    const departmentCollection = db.collection('departments');
    const subjectCollection = db.collection('subjects');

    for (const department of departments) {
      await departmentCollection.updateOne(
        { code: department.code },
        {
          $set: {
            name: department.name,
            isActive: true,
            updatedAt: now,
          },
          $setOnInsert: {
            code: department.code,
            createdAt: now,
          },
        },
        { upsert: true },
      );
    }

    const savedDepartments = await departmentCollection
      .find({ code: { $in: departments.map((department) => department.code) } })
      .toArray();
    const departmentIds = new Map(
      savedDepartments.map((department) => [
        String(department.code),
        department._id as ObjectId,
      ]),
    );

    for (const subject of subjects) {
      const departmentId = departmentIds.get(subject.department);

      if (!departmentId) {
        throw new Error(`Missing department for subject ${subject.code}`);
      }

      await subjectCollection.updateOne(
        { code: subject.code, departmentId },
        {
          $set: {
            name: subject.name,
            semester: subject.semester,
            isActive: true,
            updatedAt: now,
          },
          $setOnInsert: {
            code: subject.code,
            departmentId,
            documentCount: 0,
            createdAt: now,
          },
        },
        { upsert: true },
      );
    }

    console.log(
      `Academic seed complete: ${departments.length} departments, ${subjects.length} subjects.`,
    );
  } finally {
    await client.close();
  }
}

void runSeed().catch((error) => {
  console.error('Academic seed failed:', error);
  process.exit(1);
});
