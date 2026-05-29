Dưới đây là toàn bộ nội dung file Markdown đặc tả chi tiết thiết kế cơ sở dữ liệu hệ thống **Hybrid (Lai)** tối ưu nhất cho đồ án 8 tuần của bạn. Bản thiết kế này giữ nguyên luồng xử lý AI bất đồng bộ và thuật toán SRS nâng cao của bản 2, nhưng cắt bỏ các phần rườm rà (Folder, Course) và tích hợp cấu trúc Gamification (Streak) của bản 1 để đảm bảo tính khả thi cao nhất.

Bạn chỉ cần tạo một file tên là `DATABASE_SPECS.md` trong dự án và copy toàn bộ nội dung bên dưới vào để cả nhóm cùng phát triển.

---

# Đặc Tả Cấu Trúc Database & Toàn Bộ DTOs - Dự Án Gizmo Clone (Hybrid Version)

## Tài liệu lập trình Backend (NestJS + Mongoose + Class Validator)

Hệ thống được chia thành **6 Module lõi** nhằm phục vụ luồng đi: Người dùng đăng nhập $\rightarrow$ Upload tài liệu $\rightarrow$ AI chạy Job tạo thẻ ngắt quãng $\rightarrow$ Người dùng vào ôn tập hằng ngày tích lũy Streak.

---

## 1. Thiết Lập Hệ Thống Global (Bắt Buộc)

Để các Decorator validate lỗi và tự động ép kiểu dữ liệu từ HTTP Request gửi lên, hãy cấu hình file khởi tạo của NestJS như sau:

```typescript
// src/main.ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Kích hoạt bộ lọc dữ liệu và kiểm tra lớp DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Loại bỏ các trường thừa không được định nghĩa trong DTO
      transform: true, // Tự động convert kiểu dữ liệu (VD: string sang number)
    }),
  );

  await app.listen(3000);
}
bootstrap();
```

---

## 2. Chi Tiết Mã Nguồn Schemas & DTOs Theo Từng Module

### 2.1. Module: Users (Người dùng & Gamification)

Luồng Streak được nhúng trực tiếp vào bảng User để tối ưu tốc độ đọc dữ liệu khi người dùng vừa mở app Next.js lên.

#### Schema: `src/users/schemas/user.schema.ts`

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ _id: false })
class StreakInfo {
  @Prop({ default: 0 })
  current: number;

  @Prop({ default: 0 })
  longest: number;

  @Prop({ type: Date })
  lastActive?: Date; // Ngày gần nhất có học bài để check tính Streak
}

@Schema({ _id: false })
class UserPreferences {
  @Prop({ default: 'light', enum: ['light', 'dark'] })
  theme: string;

  @Prop({ default: 'vi', enum: ['vi', 'en'] })
  language: string;
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, trim: true, index: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true })
  name: string;

  @Prop({ default: 'student', enum: ['student', 'teacher', 'admin'] })
  role: string;

  @Prop()
  avatarUrl?: string;

  @Prop({ default: 0 })
  totalPoints: number; // Điểm kinh nghiệm tích lũy (EXP)

  @Prop({ type: StreakInfo, default: () => ({ current: 0, longest: 0 }) })
  streak: StreakInfo;

  @Prop({
    type: UserPreferences,
    default: () => ({ theme: 'light', language: 'vi' }),
  })
  preferences: UserPreferences;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
```

#### DTOs: `src/users/dto/auth.dto.ts`

```typescript
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
  @MinLength(6, { message: 'Mật khẩu phải từ 6 ký tự trở lên' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên hiển thị không được để trống' })
  name: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;
}
```

---

### 2.2. Module: AISources & Jobs (Quản lý Tác vụ AI)

Cụm này giúp hệ thống chạy bất đồng bộ. Khi user đẩy file PDF hoặc link Youtube lên, server ghi nhận vào nguồn và tạo một hàng đợi xử lý ngầm (Background Job) giúp giao diện không bị treo đơ.

#### Schema: `src/ai-generator/schemas/ai-source.schema.ts`

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type AiSourceDocument = AiSource & Document;

@Schema({ timestamps: true })
export class AiSource {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, enum: ['text', 'pdf', 'url', 'image'] })
  type: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  rawText?: string; // Text thô nếu user paste văn bản vào

  @Prop()
  fileUrl?: string; // Link lưu file trên S3 / Cloudinary nếu upload PDF/Image

  @Prop()
  extractedText?: string; // Đoạn văn bản sau khi hệ thống đã parse PDF hoặc cào dữ liệu từ URL

  @Prop({ default: 'uploaded', enum: ['uploaded', 'parsed', 'failed'] })
  status: string;
}

export const AiSourceSchema = SchemaFactory.createForClass(AiSource);
```

#### Schema: `src/ai-generator/schemas/ai-job.schema.ts`

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type AiGenerationJobDocument = AiGenerationJob & Document;

@Schema({ _id: false })
class JobOptions {
  @Prop({ default: 10 })
  cardCount: number;

  @Prop({ default: 'medium', enum: ['easy', 'medium', 'hard'] })
  difficulty: string;

  @Prop({ default: 'vi' })
  language: string;
}

@Schema({ timestamps: true })
export class AiGenerationJob {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'AiSource',
    required: true,
  })
  sourceId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Deck' })
  targetDeckId?: MongooseSchema.Types.ObjectId; // Bộ thẻ đích nhận kết quả đầu ra

  @Prop({ default: 'queued', enum: ['queued', 'running', 'done', 'failed'] })
  status: string;

  @Prop({ required: true })
  prompt: string; // Câu lệnh hệ thống gửi sang OpenAI/Gemini

  @Prop({
    type: JobOptions,
    default: () => ({ cardCount: 10, difficulty: 'medium', language: 'vi' }),
  })
  options: JobOptions;

  @Prop({ type: MongooseSchema.Types.Mixed })
  usage?: { inputTokens: number; outputTokens: number }; // Thống kê chi phí API Token

  @Prop()
  errorMessage?: string;

  @Prop({ type: Date })
  finishedAt?: Date;
}

export const AiGenerationJobSchema =
  SchemaFactory.createForClass(AiGenerationJob);
```

#### DTO: `src/ai-generator/dto/create-ai-source.dto.ts`

```typescript
import {
  IsNotEmpty,
  IsEnum,
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class CreateAiSourceAndJobDto {
  @IsEnum(['text', 'pdf', 'url', 'image'], {
    message: 'Loại nguồn học liệu không hợp lệ',
  })
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề tài liệu không được để trống' })
  title: string;

  @IsString()
  @IsOptional()
  rawText?: string;

  @IsString()
  @IsOptional()
  fileUrl?: string;

  // Cấu hình tùy chọn cho AI sinh thẻ nhúng kèm trong Request
  @IsInt()
  @Min(5)
  @Max(30)
  @IsOptional()
  cardCount?: number;

  @IsEnum(['easy', 'medium', 'hard'])
  @IsOptional()
  difficulty?: string;

  @IsString()
  @IsOptional()
  language?: string;
}
```

---

### 2.3. Module: Decks (Bộ học tập)

#### Schema: `src/decks/schemas/deck.schema.ts`

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type DeckDocument = Deck & Document;

@Schema({ timestamps: true })
export class Deck {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ default: 'private', enum: ['private', 'link', 'public'] })
  visibility: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  createdBy: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, default: 'manual', enum: ['manual', 'ai'] })
  sourceType: string;

  @Prop({ type: [String], default: [], index: true })
  tags: string[];

  @Prop({ default: 0 })
  cardCount: number;

  @Prop({ type: Date })
  lastStudiedAt?: Date;
}

export const DeckSchema = SchemaFactory.createForClass(Deck);
// Thiết lập Full-Text Search phục vụ thanh tìm kiếm khám phá bộ thẻ của cộng đồng
DeckSchema.index({ title: 'text', description: 'text', tags: 'text' });
```

#### DTOs: `src/decks/dto/deck.dto.ts`

```typescript
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
} from 'class-validator';

export class CreateDeckDto {
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề bộ học tập không được để trống' })
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['private', 'link', 'public'])
  @IsOptional()
  visibility?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}

export class UpdateDeckDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['private', 'link', 'public'])
  @IsOptional()
  visibility?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
```

---

### 2.4. Module: Cards (Chi tiết Thẻ Flashcard)

#### Schema: `src/cards/schemas/card.schema.ts`

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type CardDocument = Card & Document;

@Schema({ timestamps: true })
export class Card {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Deck',
    required: true,
    index: true,
  })
  deckId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, trim: true })
  front: string; // Mặt trước: Câu hỏi / Thuật ngữ

  @Prop({ required: true, trim: true })
  back: string; // Mặt sau: Câu trả lời / Định nghĩa

  @Prop()
  hint?: string;

  @Prop()
  explanation?: string; // Giải nghĩa chuyên sâu từ AI trợ lý

  @Prop()
  imageUrl?: string;

  @Prop({ type: [String], default: [] })
  examples: string[]; // Các ví dụ thực tế đi kèm

  @Prop({ required: true, default: 0 })
  position: number; // Thứ tự xuất hiện của thẻ trong Deck

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'AiGenerationJob' })
  aiJobId?: MongooseSchema.Types.ObjectId; // Định danh thẻ này được đẻ ra từ Job AI nào
}

export const CardSchema = SchemaFactory.createForClass(Card);
// Gom index để query nhanh danh sách thẻ theo thứ tự sắp xếp của bộ bài
CardSchema.index({ deckId: 1, position: 1 });
```

#### DTOs: `src/cards/dto/card.dto.ts`

```typescript
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsMongoId,
  IsInt,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCardDto {
  @IsMongoId()
  @IsNotEmpty()
  deckId: string;

  @IsString()
  @IsNotEmpty({ message: 'Nội dung mặt trước không được bỏ trống' })
  front: string;

  @IsString()
  @IsNotEmpty({ message: 'Nội dung mặt sau không được bỏ trống' })
  back: string;

  @IsString()
  @IsOptional()
  hint?: string;

  @IsString()
  @IsOptional()
  explanation?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  examples?: string[];

  @IsInt()
  @Min(0)
  @IsNotEmpty()
  position: number;
}

// Cấu trúc mảng dùng để lưu nhiều thẻ cùng lúc (Bulk Insert) sau khi AI xử lý xong Job
export class CreateBulkCardsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCardDto)
  cards: CreateCardDto[];
}
```

---

### 2.5. Module: StudySessions & Reviews (Phiên học & Nhật ký làm bài)

Lưu lịch sử chi tiết từng lượt bấm để vẽ biểu đồ phân tích tần suất học tập của sinh viên.

#### Schema: `src/study/schemas/study-session.schema.ts`

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type StudySessionDocument = StudySession & Document;

@Schema({ _id: false })
class SessionStats {
  @Prop({ default: 0 })
  correct: number;

  @Prop({ default: 0 })
  wrong: number;

  @Prop({ default: 0 })
  skipped: number;

  @Prop({ default: 0 })
  timeSpentSec: number; // Tổng thời gian học phiên này (giây)
}

@Schema({ timestamps: { createdAt: 'startedAt', updatedAt: false } })
export class StudySession {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Deck',
    required: true,
    index: true,
  })
  deckId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, enum: ['flashcard', 'learn', 'test', 'match'] })
  mode: string; // Các chế độ học tương tự Quizlet/Gizmo

  @Prop({ type: Date })
  finishedAt?: Date;

  @Prop({
    type: SessionStats,
    default: () => ({ correct: 0, wrong: 0, skipped: 0, timeSpentSec: 0 }),
  })
  stats: SessionStats;
}

export const StudySessionSchema = SchemaFactory.createForClass(StudySession);
```

#### Schema: `src/study/schemas/card-review.schema.ts`

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type CardReviewDocument = CardReview & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class CardReview {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'StudySession',
    required: true,
    index: true,
  })
  sessionId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Card', required: true })
  cardId: MongooseSchema.Types.ObjectId;

  @Prop()
  answer?: string; // Đáp án user gõ vào (nếu chọn chế độ Test/Learn)

  @Prop({ required: true })
  isCorrect: boolean;

  @Prop({ required: true, enum: ['again', 'hard', 'good', 'easy'] })
  rating: string; // Thang đánh giá SRS phục vụ tính toán lịch học tiếp theo

  @Prop({ required: true })
  responseTimeMs: number; // Thời gian phản xạ tính theo mili-giây
}

export const CardReviewSchema = SchemaFactory.createForClass(CardReview);
```

#### DTO: `src/study/dto/log-review.dto.ts`

```typescript
import {
  IsNotEmpty,
  IsMongoId,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';

export class LogCardReviewDto {
  @IsMongoId()
  @IsNotEmpty()
  sessionId: string;

  @IsMongoId()
  @IsNotEmpty()
  cardId: string;

  @IsString()
  @IsOptional()
  answer?: string;

  @IsBoolean()
  @IsNotEmpty()
  isCorrect: boolean;

  @IsEnum(['again', 'hard', 'good', 'easy'])
  @IsNotEmpty()
  rating: string;

  @IsInt()
  @IsNotEmpty()
  responseTimeMs: number;
}
```

---

### 2.6. Module: CardProgress (Thuật toán Lặp lại ngắt quãng - SRS)

Bảng cốt lõi theo dõi sát sao chu kỳ nhớ quên của bộ não. Trường `dueAt` chính là kim chỉ nam để Backend lọc ra xem hôm nay user cần học những thẻ nào.

#### Schema: `src/study/schemas/card-progress.schema.ts`

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type CardProgressDocument = CardProgress & Document;

@Schema({ timestamps: { createdAt: false, updatedAt: true } })
export class CardProgress {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Card', required: true })
  cardId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Deck', required: true })
  deckId: MongooseSchema.Types.ObjectId;

  @Prop({ default: 0, min: 0, max: 100 })
  mastery: number; // Tiến trình thành thục tính theo % (0% -> 100%)

  @Prop({ default: 'new', enum: ['new', 'learning', 'review', 'mastered'] })
  status: string;

  @Prop({ default: 2.5 })
  easeFactor: number; // Hệ số độ dễ của thuật toán SM-2

  @Prop({ default: 0 })
  intervalDays: number; // Khoảng cách số ngày cho lần ôn tập kế tiếp

  @Prop({ required: true, type: Date, index: true })
  dueAt: Date; // Thời hạn bắt buộc phải lật lại thẻ này để học

  @Prop({ default: 0 })
  correctCount: number;

  @Prop({ default: 0 })
  wrongCount: number;
}

export const CardProgressSchema = SchemaFactory.createForClass(CardProgress);

// Đảm bảo không bao giờ bị trùng lặp bản ghi tiến độ của cùng một user trên một thẻ bài
CardProgressSchema.index({ userId: 1, cardId: 1 }, { unique: true });
// Tối ưu hóa câu lệnh tìm kiếm: "Lấy các thẻ đến hạn ôn của bộ bài X thuộc user Y"
CardProgressSchema.index({ userId: 1, deckId: 1, dueAt: 1 });
```

---

## 3. Bản Đồ Kiểm Tra Hệ Thống Chỉ Mục (Indexes Check)

Hãy đảm bảo sau khi chạy ứng dụng, MongoDB Compass của bạn hiển thị đủ danh sách các chỉ mục tối ưu hiệu năng sau:

| Tên Collection  | Chỉ mục (Indexes Setup)                                | Tác dụng thực tế                               |
| --------------- | ------------------------------------------------------ | ---------------------------------------------- |
| `users`         | `{ email: 1 }` (Unique)                                | Đăng nhập siêu tốc, không trùng tài khoản      |
| `decks`         | `{ title: "text", description: "text", tags: "text" }` | Tìm kiếm bộ thẻ công khai thông minh           |
| `cards`         | `{ deckId: 1, position: 1 }`                           | Tải mượt danh sách thẻ theo đúng thứ tự        |
| `card_progress` | `{ userId: 1, cardId: 1 }` (Unique)                    | Bảo vệ toàn vẹn dữ liệu thuật toán SRS         |
| `card_progress` | `{ userId: 1, deckId: 1, dueAt: 1 }`                   | Lọc chính xác danh sách câu hỏi cần ôn hôm nay |

"// === HỆ THỐNG CƠ SỞ DỮ LIỆU QUIZZY (GIZMO CLONE) ===

Table users {
\_id objectId [pk]
name string [note: 'Tên hiển thị']
email string [unique, note: 'Email đăng nhập']
passwordHash string [note: 'Mật khẩu đã mã hóa bcrypt']
role string [note: 'student | teacher | admin']
avatarUrl string
createdAt timestamp
updatedAt timestamp
}

Table folders {
\_id objectId [pk]
userId objectId [note: 'Chủ sở hữu thư mục']
name string
description string
createdAt timestamp
updatedAt timestamp
}

Table decks {
\_id objectId [pk]
title string
description string
visibility string [note: 'public | private']
createdBy objectId [note: 'User tạo bộ bài']
folderId objectId [null, note: 'Có thể nằm trong thư mục hoặc không']
sourceType string [note: 'manual (tự tạo) | ai (AI sinh)']
cardCount int [note: 'Kỹ thuật Hybrid: Lưu số lượng thẻ để tối ưu tốc độ đọc']
lastStudiedAt timestamp
createdAt timestamp
updatedAt timestamp
}

Table cards {
\_id objectId [pk]
deckId objectId [note: 'Thuộc bộ bài nào']
front string [note: 'Mặt trước (Từ vựng/Câu hỏi)']
back string [note: 'Mặt sau (Nghĩa/Đáp án)']
explanation string [note: 'Giải thích chi tiết/Ví dụ']
imageUrl string [null]
position int [note: 'Thứ tự sắp xếp thẻ trong bộ']
createdAt timestamp
updatedAt timestamp
}

Table card_progress {
\_id objectId [pk]
userId objectId
cardId objectId
deckId objectId
mastery int [note: 'Độ chín kiến thức (0 -> 100)']
status string [note: 'learning | review | mastered']
easeFactor float [note: 'Độ dễ của thẻ phục vụ thuật toán SRS (mặc định 2.5)']
intervalDays int [note: 'Số ngày hẹn gặp lại thẻ này']
dueAt timestamp [note: 'Thời gian thẻ hết hạn, cần lôi ra học ngay']
}

Table study_sessions {
\_id objectId [pk]
userId objectId
deckId objectId
cardsStudied int [note: 'Số thẻ đã lật trong phiên']
correctCount int [note: 'Số câu bấm thuộc/dễ']
score float [note: 'Tỷ lệ phần trăm đúng']
duration int [note: 'Thời gian học (tính bằng giây)']
startedAt timestamp
completedAt timestamp
}

// === ĐỊNH NGHĨA MỐI QUAN HỆ GIỮA CÁC BẢNG (RELATIONSHIPS) ===

Ref: folders.userId > users.\_id [delete: cascade]
Ref: decks.createdBy > users.\_id [delete: cascade]
Ref: decks.folderId > folders.\_id [delete: set null]
Ref: cards.deckId > decks.\_id [delete: cascade]

// Mối quan hệ phục vụ thuật toán học lặp lại ngắt quãng (SRS)
Ref: card_progress.userId > users.\_id
Ref: card_progress.cardId > cards.\_id [delete: cascade]
Ref: card_progress.deckId > decks.\_id

// Mối quan hệ phục vụ thống kê lịch sử học tập
Ref: study_sessions.userId > users.\_id
Ref: study_sessions.deckId > decks.\_id"
