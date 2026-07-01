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

interface SubjectSeed {
  code: string;
  name: string;
  department: string;
  semester: number;
}

const commonSubjects = [
  {
    code: 'PRF192',
    name: 'Lap trinh C co ban (Programming Fundamentals)',
    semester: 1,
  },
  {
    code: 'MAE101',
    name: 'Toan cho ky thuat (Mathematics for Engineering)',
    semester: 1,
  },
  { code: 'SSL101', name: 'Ky nang hoc tap dai hoc', semester: 1 },
  { code: 'VOV', name: 'Vovinam 1', semester: 1 },
  {
    code: 'PRO192',
    name: 'Lap trinh huong doi tuong Java (Object-Oriented Programming)',
    semester: 2,
  },
  {
    code: 'MAD101',
    name: 'Toan roi rac (Discrete Mathematics)',
    semester: 2,
  },
  {
    code: 'OSG202',
    name: 'He dieu hanh (Operating Systems)',
    semester: 2,
  },
  {
    code: 'SSG104',
    name: 'Ky nang giao tiep va lam viec nhom',
    semester: 2,
  },
  {
    code: 'CSD201',
    name: 'Cau truc du lieu va giai thuat',
    semester: 3,
  },
  {
    code: 'DBI202',
    name: 'Co so du lieu (Database Systems)',
    semester: 3,
  },
  {
    code: 'NWC203',
    name: 'Mang may tinh (Networking)',
    semester: 3,
  },
  {
    code: 'JPD_CHN1',
    name: 'Tieng Nhat hoac Tieng Trung 1',
    semester: 3,
  },
  {
    code: 'MAS291',
    name: 'Xac suat thong ke (Probability and Statistics)',
    semester: 4,
  },
  {
    code: 'PRJ301',
    name: 'Lap trinh Web voi Java (Java Web)',
    semester: 4,
  },
  {
    code: 'SWE202',
    name: 'Nhap mon Ky thuat phan mem',
    semester: 4,
  },
  {
    code: 'IOT102',
    name: 'Internet of Things',
    semester: 4,
  },
];

const seSpecializedSubjects = [
  {
    code: 'SWP391',
    name: 'Do an du an phan mem (Software Project)',
    semester: 5,
  },
  {
    code: 'SWT301',
    name: 'Kiem thu phan mem (Software Testing)',
    semester: 5,
  },
  {
    code: 'SWR302',
    name: 'Yeu cau phan mem (Software Requirements)',
    semester: 5,
  },
  {
    code: 'JPD_CHN2',
    name: 'Tieng Nhat hoac Tieng Trung 2',
    semester: 5,
  },
  {
    code: 'OJT',
    name: 'Thuc tap doanh nghiep (On-the-Job Training)',
    semester: 6,
  },
  {
    code: 'SWD392',
    name: 'Kien truc va thiet ke phan mem',
    semester: 7,
  },
  {
    code: 'PRM392',
    name: 'Lap trinh di dong (Mobile Programming)',
    semester: 7,
  },
  {
    code: 'ITE302C',
    name: 'Dao duc trong CNTT',
    semester: 7,
  },
  {
    code: 'SPM',
    name: 'Quan ly du an phan mem (Software Project Management)',
    semester: 8,
  },
  {
    code: 'WRP',
    name: 'Viet bao cao ky thuat',
    semester: 8,
  },
  {
    code: 'SE_ELECTIVE',
    name: 'Mon tu chon chuyen nganh SE',
    semester: 8,
  },
  {
    code: 'SEP490',
    name: 'Do an tot nghiep SE (Capstone Project)',
    semester: 9,
  },
  {
    code: 'MLN',
    name: 'Cac mon ly luan chinh tri',
    semester: 9,
  },
];

const aiSpecializedSubjects = [
  {
    code: 'AIL302M',
    name: 'Hoc may (Machine Learning)',
    semester: 5,
  },
  {
    code: 'DAP391_PYP',
    name: 'Lap trinh Python cho Khoa hoc du lieu',
    semester: 5,
  },
  {
    code: 'AIP391',
    name: 'Do an du an AI co ban',
    semester: 5,
  },
  {
    code: 'JPD_CHN2',
    name: 'Tieng Nhat hoac Tieng Trung 2',
    semester: 5,
  },
  {
    code: 'OJT',
    name: 'Thuc tap doanh nghiep AI/Data',
    semester: 6,
  },
  {
    code: 'AIL401C',
    name: 'Hoc sau (Deep Learning)',
    semester: 7,
  },
  {
    code: 'AIL402C',
    name: 'Xu ly ngon ngu tu nhien (Natural Language Processing)',
    semester: 7,
  },
  {
    code: 'DBS',
    name: 'He quan tri CSDL nang cao',
    semester: 7,
  },
  {
    code: 'AIL403C',
    name: 'Thi giac may tinh (Computer Vision)',
    semester: 8,
  },
  {
    code: 'AIP',
    name: 'AI in Production',
    semester: 8,
  },
  {
    code: 'AI_ELECTIVE',
    name: 'Mon tu chon chuyen nganh AI',
    semester: 8,
  },
  {
    code: 'AIP490_GRA',
    name: 'Do an tot nghiep AI',
    semester: 9,
  },
  {
    code: 'MLN',
    name: 'Cac mon ly luan chinh tri',
    semester: 9,
  },
];

const subjects: SubjectSeed[] = [
  ...commonSubjects.flatMap((subject) => [
    { ...subject, department: 'AI' },
    { ...subject, department: 'SE' },
  ]),
  ...aiSpecializedSubjects.map((subject) => ({
    ...subject,
    department: 'AI',
  })),
  ...seSpecializedSubjects.map((subject) => ({
    ...subject,
    department: 'SE',
  })),
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
