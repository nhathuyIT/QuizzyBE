# Kế Hoạch Nâng Cấp Quizzy — Tài Liệu Học Tập FPT University

> **Cập nhật**: 2026-06-26
> **Phiên bản**: v1 — Academic Module + Token Optimization + Firebase Upload

---

## Mục Tiêu

Nâng cấp Quizzy từ ứng dụng flashcard cá nhân lên hệ thống tài liệu học tập dành cho sinh viên FPT University, phân loại theo **Chuyên ngành → Kì (1-9) → Môn học → Tài liệu**.

---

## Mục Lục

- [1. Quyết Định Kiến Trúc](#1-quyết-định-kiến-trúc)
- [2. Redis — RESP vs REST](#2-redis--resp-vs-rest)
- [3. Tối Ưu Token Chat Context](#3-tối-ưu-token-chat-context)
- [4. Database Schema Mới](#4-database-schema-mới)
- [5. Upload File — Firebase Storage + BE Metadata](#5-upload-file--firebase-storage--be-metadata)
- [6. Backend Module: AcademicModule](#6-backend-module-academicmodule)
- [7. Seed Data](#7-seed-data)
- [8. Kế Hoạch Triển Khai](#8-kế-hoạch-triển-khai)

---

## 1. Quyết Định Kiến Trúc

### ❌ Microservices — KHÔNG CẦN

| Tiêu chí | Đánh giá |
|---|---|
| Team size | Nhỏ → monolith phù hợp |
| Codebase | ~10 modules, chưa đủ lớn để tách |
| Deploy | Railway free tier → chạy nhiều service = tốn tiền |
| Complexity | Service discovery, distributed DB, inter-service comm → quá phức tạp |
| Thời gian | Thêm 1 module trong monolith = vài ngày. Tách microservice = vài tuần |

**Kết luận:** Giữ **Modular Monolith**. Thêm `AcademicModule` mới bên cạnh các module hiện có.

### ❌ Chunking + Embedding (RAG) — KHÔNG CẦN (hiện tại)

| Lý do | Chi tiết |
|---|---|
| Quá phức tạp cho quy mô hiện tại | Cần thêm vector DB (Pinecone/Weaviate), embedding model, chunking pipeline |
| Tốn token/tiền | Mỗi document cần gọi embedding API để vector hóa, Gemini free tier sẽ hết quota ngay |
| Chưa cần thiết | Mục tiêu hiện tại là lưu trữ và chia sẻ tài liệu, không phải semantic search trong nội dung file |
| Có thể thêm sau | Khi dự án scale lên và có budget, thêm RAG layer không ảnh hưởng schema hiện tại |

**Hiện tại chỉ cần:** Upload file → lưu metadata → hiển thị danh sách → download.

### ✅ BullMQ — GIỮ LẠI

BullMQ + Redis chỉ phục vụ duy nhất một việc: xử lý job generate flashcard bất đồng bộ. Gọi Gemini API mất 10-30 giây, nếu gọi trực tiếp trong request sẽ bị HTTP timeout.

```
User nhấn "Generate deck"
    → BE tạo job trong queue Redis (BullMQ)
    → Worker lấy job: gọi Gemini API → tạo Deck + Cards
    → FE poll GET /jobs/:id mỗi 2 giây
```

---

## 2. Redis — RESP vs REST

### RESP là gì?

**RESP (REdis Serialization Protocol)** là giao thức truyền thông gốc của Redis. Khi bạn dùng Redis, có 2 cách kết nối:

| Giao thức | Thư viện trong dự án | Cách hoạt động | Phù hợp |
|---|---|---|---|
| **RESP** (TCP) | `ioredis` | Kết nối TCP trực tiếp đến Redis server, persistent connection, low latency | Server truyền thống (Railway, VPS, Docker) |
| **REST** (HTTP) | `@upstash/redis` | Gọi Redis qua HTTP API, stateless, mỗi request tạo connection mới | Serverless (Vercel Functions, AWS Lambda) |

### Dự án hiện tại đang dùng cả hai

```
package.json:
  "ioredis": "^5.11.1"          ← RESP (dùng cho BullMQ)
  "@upstash/redis": "^1.38.0"  ← REST (chưa thấy được sử dụng thực tế)
```

### Khuyến nghị: Dùng RESP (ioredis) — BỎ @upstash/redis

Vì dự án deploy trên **Railway** (server truyền thống, không phải serverless):

- **RESP qua ioredis** là lựa chọn đúng: latency thấp hơn (~1ms vs ~50ms), BullMQ bắt buộc dùng ioredis, kết nối persistent ổn định.
- **@upstash/redis** không cần thiết: REST API chỉ có ý nghĩa khi chạy trên serverless (Vercel Functions không giữ được TCP connection). Railway giữ process chạy liên tục nên RESP hoạt động tốt.

```
Kết nối hiện tại (đã đúng):
Railway NestJS ──── RESP/TCP ────▶ Railway Redis
                    (ioredis)        (port 6379)
```

**Có thể xóa** `@upstash/redis` khỏi `package.json` nếu không dùng:

```bash
npm uninstall @upstash/redis
```

### Cấu hình Redis (.env)

```env
# RESP connection (ioredis + BullMQ dùng)
REDIS_URL=redis://default:password@redis.railway.internal:6379

# Hoặc tách riêng
REDIS_HOST=redis.railway.internal
REDIS_PORT=6379
REDIS_PASSWORD=your-railway-redis-password
```

Trên Railway, dùng **internal URL** (`redis.railway.internal`) để tránh latency vì Redis và NestJS nằm cùng private network.

---

## 3. Tối Ưu Token Chat Context

### Hiện trạng (RẤT TỐN TOKEN)

Mỗi lần user gửi 1 tin nhắn, BE gửi lên Gemini tất cả:

1. System prompt (~100 tokens)
2. **Tối đa 50 thẻ flashcard** của deck làm context (~2000-5000 tokens)
3. **20 tin nhắn cũ** làm lịch sử chat (~2000-8000 tokens)
4. Tin nhắn mới của user

→ Mỗi request có thể tốn **5,000 - 13,000 input tokens**

### Giải pháp

#### Bước 1: Thay đổi `.env` (không cần sửa code)

```diff
- CHATBOT_MAX_HISTORY=20
+ CHATBOT_MAX_HISTORY=4

- CHATBOT_MAX_CARD_CONTEXT=50
+ CHATBOT_MAX_CARD_CONTEXT=10
```

#### Bước 2: Sửa `prompts.ts` — chỉ gửi `front` + `back`

```typescript
// src/modules/chatbot/constants/prompts.ts

// TRƯỚC: format tốn token
// "1. Front: X | Back: Y | Hint: Z | Explanation: W"

// SAU: format tiết kiệm
// "1. X → Y"
export function buildDeckContextPrompt(cards: string): string {
  if (!cards.trim()) return '';
  return `Deck context:\n${cards}`.trim();
}
```

**Ước tính tiết kiệm:** Giảm ~70-80% input tokens mỗi lần chat.

---

## 4. Database Schema Mới

### Luồng FE hiển thị

```
Chọn Chuyên ngành (AI / SE)
    → Hiển thị 9 kì (Semester 1-9)
        → Chọn kì → Hiển thị danh sách môn học của kì đó
            → Chọn môn → Hiển thị danh sách tài liệu
                → Xem / Tải file
```

### 4.1 Schema: `Department` (Chuyên ngành)

```typescript
// src/modules/academic/schemas/department.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DepartmentDocument = Department & Document;

@Schema({ timestamps: true, collection: 'departments' })
export class Department {
  @Prop({ required: true, unique: true, trim: true, uppercase: true })
  code: string;
  // 'AI', 'SE'

  @Prop({ required: true, trim: true })
  name: string;
  // 'Artificial Intelligence', 'Software Engineering'

  @Prop({ trim: true })
  description?: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);
```

### 4.2 Schema: `Subject` (Môn học)

```typescript
// src/modules/academic/schemas/subject.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type SubjectDocument = Subject & Document;

@Schema({ timestamps: true, collection: 'subjects' })
export class Subject {
  @Prop({ required: true, trim: true, uppercase: true })
  code: string;
  // 'PRF192', 'SWP391', 'AIE301m'

  @Prop({ required: true, trim: true })
  name: string;
  // 'Programming Fundamentals'

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Department',
    required: true,
    index: true,
  })
  departmentId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, min: 1, max: 9 })
  semester: number;
  // Kì học 1-9

  @Prop({ default: 0 })
  documentCount: number;
  // Denormalized counter — tránh count query mỗi lần hiển thị

  @Prop({ default: true })
  isActive: boolean;
}

export const SubjectSchema = SchemaFactory.createForClass(Subject);

// Compound unique: cùng mã môn có thể thuộc cả 2 ngành
SubjectSchema.index({ code: 1, departmentId: 1 }, { unique: true });
// Query tối ưu: "Lấy tất cả môn ngành AI kì 5"
SubjectSchema.index({ departmentId: 1, semester: 1 });
```

### 4.3 Schema: `AcademicDocument` (Tài liệu)

```typescript
// src/modules/academic/schemas/academic-document.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type AcademicDocumentDoc = AcademicDocument & Document;

@Schema({ timestamps: true, collection: 'academic_documents' })
export class AcademicDocument {
  @Prop({ required: true, trim: true, maxlength: 200 })
  title: string;
  // 'Slide chương 1 - OOP Basics'

  @Prop({ trim: true, maxlength: 500 })
  description?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Subject',
    required: true,
    index: true,
  })
  subjectId: MongooseSchema.Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  uploadedBy: MongooseSchema.Types.ObjectId;

  // === File Info (từ Firebase Storage) ===

  @Prop({ required: true })
  fileUrl: string;
  // Firebase Storage download URL

  @Prop({ required: true })
  fileName: string;
  // 'slide-chuong-1.pdf'

  @Prop({
    required: true,
    enum: ['pdf', 'docx', 'pptx', 'xlsx', 'other'],
  })
  fileType: string;

  @Prop({ required: true })
  fileSize: number;
  // Bytes

  @Prop({ required: true })
  storagePath: string;
  // Firebase path: 'documents/AI/5/PRF192/abc123.pdf'
  // Dùng để xóa file trên Firebase khi cần

  // === Metadata ===

  @Prop({ default: 'active', enum: ['active', 'archived'] })
  status: string;

  @Prop({ default: 0 })
  downloadCount: number;

  @Prop({ type: [String], default: [] })
  tags: string[];
  // ['slide', 'chapter-1', 'oop']
}

export const AcademicDocumentSchema =
  SchemaFactory.createForClass(AcademicDocument);

// Tài liệu mới nhất của môn PRF192
AcademicDocumentSchema.index({ subjectId: 1, createdAt: -1 });
// Tài liệu tôi đã upload
AcademicDocumentSchema.index({ uploadedBy: 1, createdAt: -1 });
```

### 4.4 Quan hệ tổng thể

```
┌────────────────────────────────────────────────────────────┐
│                    Schema Relationships                     │
│                                                            │
│  departments ──1:N──▶ subjects ──1:N──▶ academic_documents │
│       (AI, SE)        (PRF192...)       (Slide.pdf...)     │
│                                              │             │
│                                              │ N:1         │
│                                              ▼             │
│                                           users            │
│                                              │             │
│  ┌───── existing ─────────────────────────────┤            │
│  │                                            │            │
│  ▼                                            ▼            │
│  decks ──1:N──▶ cards ──1:1──▶ card_progress  │            │
│  │                                                         │
│  │  chat_conversations ──1:N──▶ chat_messages              │
│  │                                                         │
│  │  ai_sources ──1:N──▶ ai_generation_jobs                 │
│  │                              │                          │
│  │                              ▼                          │
│  └──────────────────────── targetDeckId                     │
└────────────────────────────────────────────────────────────┘
```

---

## 5. Upload File — Firebase Storage + BE Metadata

### Luồng xử lý chi tiết

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
│                                                             │
│  1. User chọn Chuyên ngành → Kì → Môn học                  │
│  2. User chọn file PDF/Word/PPT                            │
│  3. FE upload trực tiếp lên Firebase Storage                │
│     path: documents/{deptCode}/{semester}/{subjectCode}/    │
│           {timestamp}_{sanitizedFileName}                   │
│  4. Firebase trả về download URL                            │
│  5. FE gửi POST /v1/academic/documents                     │
│     { title, subjectId, fileUrl, fileName, fileType,        │
│       fileSize, storagePath, description?, tags? }          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      NestJS Backend                          │
│                                                             │
│  1. Validate JWT (user phải đăng nhập)                      │
│  2. Validate subjectId tồn tại và isActive                  │
│  3. Validate fileUrl là URL hợp lệ từ Firebase             │
│  4. Lưu document metadata vào MongoDB                       │
│  5. subject.documentCount += 1                              │
│  6. Trả về document record                                  │
└─────────────────────────────────────────────────────────────┘
```

**Tại sao FE upload thẳng lên Firebase, không qua BE?**

- Không tốn bandwidth/memory của server Railway (gói free giới hạn)
- Firebase Storage miễn phí 5GB, có CDN tốc độ cao
- BE chỉ cần lưu metadata (URL, tên file, kích thước) vào MongoDB
- Nếu cần xóa file, BE gọi Firebase Admin SDK để xóa trên Storage

### Firebase Storage Path Convention

```
documents/
├── AI/
│   ├── 1/                          ← Kì 1
│   │   └── PRF192/
│   │       ├── 1719388800_slide-c1.pdf
│   │       └── 1719475200_de-thi-gk.pdf
│   ├── 5/                          ← Kì 5
│   │   └── AIE301m/
│   │       └── 1719561600_ml-notes.pdf
│   └── ...
└── SE/
    ├── 5/
    │   └── SWP391/
    │       └── 1719648000_sprint-guide.docx
    └── ...
```

---

## 6. Backend Module: AcademicModule

### Cấu trúc file

```
src/modules/academic/
├── academic.module.ts
├── controllers/
│   ├── department.controller.ts     // GET departments
│   ├── subject.controller.ts        // GET subjects by dept + semester
│   └── document.controller.ts       // CRUD documents
├── services/
│   ├── department.service.ts
│   ├── subject.service.ts
│   └── document.service.ts
├── repositories/
│   ├── department.repository.ts
│   ├── subject.repository.ts
│   └── document.repository.ts
├── dto/
│   ├── create-document.dto.ts
│   └── query-documents.dto.ts
├── schemas/
│   ├── department.schema.ts
│   ├── subject.schema.ts
│   └── academic-document.schema.ts
└── seed/
    └── academic.seed.ts             // Seed departments + subjects
```

### API Endpoints

```http
# ── Departments ──
GET  /v1/academic/departments
# Response: [{ _id, code: "AI", name: "Artificial Intelligence" }, ...]

# ── Subjects ──
GET  /v1/academic/departments/:deptId/subjects
GET  /v1/academic/departments/:deptId/subjects?semester=5
# Response: [{ _id, code: "PRF192", name: "...", semester: 1, documentCount: 12 }, ...]

# ── Documents ──
GET  /v1/academic/subjects/:subjectId/documents?page=1&limit=20
# Response: paginated documents list

POST /v1/academic/documents                          # Auth required
# Body: { title, subjectId, fileUrl, fileName, fileType, fileSize, storagePath, description?, tags? }

DELETE /v1/academic/documents/:id                    # Owner hoặc Admin
# Soft delete (status → archived)

GET  /v1/academic/documents/my                       # Auth required
# Tài liệu tôi đã upload

PATCH /v1/academic/documents/:id/download-count      # Tăng counter khi download
```

---

## 7. Seed Data

```typescript
// src/modules/academic/seed/academic.seed.ts

const departments = [
  { code: 'AI', name: 'Artificial Intelligence' },
  { code: 'SE', name: 'Software Engineering' },
];

// Lưu ý: Một số môn chung (PRF192, MAE101...) thuộc cả 2 ngành
// → tạo 2 record riêng, compound unique index { code, departmentId }

const subjects = [
  // ── Ngành AI ──
  // Kì 1
  { code: 'PRF192', name: 'Programming Fundamentals', department: 'AI', semester: 1 },
  { code: 'MAE101', name: 'Mathematics for Engineering', department: 'AI', semester: 1 },
  // Kì 2
  { code: 'CEA201', name: 'Computer Organization and Architecture', department: 'AI', semester: 2 },
  { code: 'MAD101', name: 'Discrete Mathematics', department: 'AI', semester: 2 },
  // Kì 3
  { code: 'PRO192', name: 'Object-Oriented Programming', department: 'AI', semester: 3 },
  // Kì 5
  { code: 'AIE301m', name: 'Artificial Intelligence', department: 'AI', semester: 5 },
  // Kì 6
  { code: 'AIM301m', name: 'Applied Machine Learning', department: 'AI', semester: 6 },

  // ── Ngành SE ──
  // Kì 1
  { code: 'PRF192', name: 'Programming Fundamentals', department: 'SE', semester: 1 },
  { code: 'MAE101', name: 'Mathematics for Engineering', department: 'SE', semester: 1 },
  // Kì 5
  { code: 'SWP391', name: 'Application Development Project', department: 'SE', semester: 5 },
  // Kì 6
  { code: 'SWD392', name: 'SW Architecture and Design', department: 'SE', semester: 6 },
  // ... bổ sung thêm theo danh sách FPT thực tế
];
```

---

## 8. Kế Hoạch Triển Khai

### Phase 1: Token Optimization — ~30 phút

- [ ] Cập nhật `.env` trên Railway: `CHATBOT_MAX_HISTORY=4`, `CHATBOT_MAX_CARD_CONTEXT=10`
- [ ] Sửa `prompts.ts`: deck context chỉ gửi `front` → `back`
- [ ] Xóa `@upstash/redis` nếu không dùng

### Phase 2: Backend — Academic Module — ~1 ngày

- [ ] Tạo 3 schemas: Department, Subject, AcademicDocument
- [ ] Subject unique index compound `{ code, departmentId }`
- [ ] Tạo AcademicModule: repositories, services, controllers
- [ ] Tạo DTOs + class-validator validation
- [ ] Tạo seed script cho departments + subjects
- [ ] Đăng ký AcademicModule trong AppModule
- [ ] Test API với Postman

### Phase 3: Frontend — Academic Document UI — ~2 ngày

- [ ] Cấu hình Firebase Storage trong project FE
- [ ] Trang duyệt tài liệu: Department → Semester grid → Subject list → Documents
- [ ] Component upload tài liệu (chọn file → upload Firebase → gửi metadata BE)
- [ ] Component danh sách tài liệu + download
- [ ] Responsive design + loading states

### Phase 4: Deploy + Test — ~nửa ngày

- [ ] Push BE lên GitHub → Railway auto-deploy
- [ ] Cấu hình Firebase Storage rules (chỉ authenticated users upload)
- [ ] Test end-to-end: upload → hiển thị → download
