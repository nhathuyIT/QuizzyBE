# 🤖 Kế Hoạch Tích Hợp AI Chatbot - Quizzy (v2)

> **Cập nhật lần cuối**: 2026-06-24
> **Phiên bản**: v2 — Bổ sung Redis/BullMQ, IAiProvider Pattern, chi tiết code implementation

---

## Mục Tiêu

Xây dựng AI Chatbot sử dụng **Google Gemini API** với 2 chức năng cốt lõi:

1. **Chat thông minh về Flashcard**: Bot truy vấn nội dung flashcard của user, giải thích, đặt câu hỏi kiểm tra, gợi ý cách ghi nhớ
2. **Generate Flashcard từ Documents**: User gửi text/upload PDF → AI phân tích và tự động sinh bộ flashcard chất lượng cao

---

## Mục Lục

- [1. Phân Tích Tính Khả Thi](#1-phân-tích-tính-khả-thi)
- [2. Quyết Định Kiến Trúc](#2-quyết-định-kiến-trúc)
- [3. Kiến Trúc Tổng Quan](#3-kiến-trúc-tổng-quan)
- [4. Database Schema Mới](#4-database-schema-mới)
- [5. IAiProvider — Abstract AI Layer](#5-iaiprovider--abstract-ai-layer)
- [6. GeminiProvider — Implementation](#6-geminiprovider--implementation)
- [7. Redis & BullMQ — Job Queue](#7-redis--bullmq--job-queue)
- [8. ChatbotService — Business Logic](#8-chatbotservice--business-logic)
- [9. Prompt Engineering](#9-prompt-engineering)
- [10. Luồng Xử Lý Chi Tiết](#10-luồng-xử-lý-chi-tiết)
- [11. API Endpoints](#11-api-endpoints)
- [12. DTOs Chi Tiết](#12-dtos-chi-tiết)
- [13. Cấu Trúc File](#13-cấu-trúc-file)
- [14. Cấu Hình Môi Trường](#14-cấu-hình-môi-trường)
- [15. Bảo Mật & Rate Limiting](#15-bảo-mật--rate-limiting)
- [16. Error Handling](#16-error-handling)
- [17. Chi Phí & Giới Hạn API](#17-chi-phí--giới-hạn-api)
- [18. Kế Hoạch Triển Khai Theo Phase](#18-kế-hoạch-triển-khai-theo-phase)

---

## 1. Phân Tích Tính Khả Thi

### ✅ Database Schema — SẴN SÀNG

| Schema hiện có | Vai trò trong Chatbot | Trạng thái |
|---|---|---|
| `AiSource` (type, rawText, fileUrl, extractedText, status) | Lưu tài liệu upload (text, pdf, url, image) | ✅ Có sẵn |
| `AiGenerationJob` (prompt, options, usage, status) | Queue job AI, track token usage | ✅ Có sẵn |
| `Card` (front, back, hint, explanation, examples, aiJobId) | Output flashcard từ AI — đã có `aiJobId` liên kết | ✅ Có sẵn |
| `Deck` (sourceType: `'ai'`, cardCount) | Gom nhóm flashcard do AI sinh | ✅ Có sẵn |
| `CardProgress` (mastery, easeFactor, dueAt) | Theo dõi tiến trình SRS | ✅ Có sẵn |

### ✅ Backend API — SẴN SÀNG

| API có sẵn | Vai trò |
|---|---|
| `POST /v1/cards/bulk` (`CardService.createBulkCards`) | Bulk insert cards sau khi AI generate |
| `DeckService.createDeck` | Tạo deck mới với `sourceType: 'ai'` |
| `DeckService.validateDeckOwner` | Xác thực quyền sở hữu deck |
| `CardService.findByDeckId` | Lấy toàn bộ cards trong deck → inject vào AI context |
| `AiGeneratorRepository.createSource/createJob/updateJobStatus` | CRUD cho AI pipeline |
| JWT Auth (Passport) | Xác thực user cho mọi request |

### ❌ Cần Bổ Sung

| Thành phần | Package/Config | Mô tả |
|---|---|---|
| Gemini SDK | `@google/generative-ai` | SDK chính thức của Google |
| PDF Parser | `pdf-parse` | Extract text từ file PDF |
| Redis Client | `ioredis` | Kết nối Redis |
| Job Queue | `@nestjs/bullmq`, `bullmq` | Hàng đợi job AI bất đồng bộ |
| Rate Limiter | `@nestjs/throttler` | Rate limiting per-user |
| File Upload Types | `@types/multer` | TypeScript types cho upload |
| Schema mới | `ChatConversation`, `ChatMessage` | Lưu lịch sử chat |
| ENV | `GEMINI_API_KEY`, `REDIS_URL` | API keys & config |

---

## 2. Quyết Định Kiến Trúc

### 2.1. ✅ Redis — DÙNG (có chọn lọc)

**Tại sao cần Redis cho AI Chatbot:**

| Use Case | Giải pháp | Lý do |
|---|---|---|
| **Job Queue** | BullMQ + Redis | `AiGenerationJob` đã có status `queued → running → done → failed`. BullMQ biến nó thành hàng đợi thực sự: retry on failure, concurrency control, delayed jobs |
| **Rate Limiting** | `@nestjs/throttler` + Redis store | Giới hạn API calls per-user chính xác giữa nhiều server instances. Bảo vệ Gemini API key |
| **Response Cache** | Redis TTL cache | Cùng 1 đoạn text → không cần gọi Gemini lại. Cache key = hash(content + options). TTL = 2 giờ |

**KHÔNG dùng Redis cho:**
- Chat history → MongoDB (cần persistent, query phức tạp)
- Session auth → JWT stateless (đã có)
- Full object caching → MongoDB đủ nhanh cho CRUD đơn giản

### 2.2. ❌ Microservices — KHÔNG DÙNG

| Tiêu chí | Đánh giá |
|---|---|
| Team size | < 5 người → monolith phù hợp |
| Codebase size | 9 modules, ~5000 LOC → chưa cần tách |
| Deploy target | Vercel serverless → không hỗ trợ microservices tốt |
| Thời gian | 8 tuần → setup microservices infrastructure tốn 2-3 tuần |
| Complexity | Service discovery, distributed transactions, separate DBs → quá phức tạp |

**Kết luận**: Giữ **Modular Monolith** — NestJS module system đã cung cấp encapsulation tốt.

### 2.3. ⚠️ Hexagonal Architecture — ÁP DỤNG MỘT PHẦN (chỉ AI Layer)

Dự án hiện tại **đã dùng pattern gần hexagonal**:

```
Controller (Adapter In) → Service (Use Case) → Repository (Adapter Out) → MongoDB
```

**Chỉ áp dụng thêm cho AI layer** — tạo `IAiProvider` interface:
- Dễ swap Gemini ↔ OpenAI ↔ Claude mà không sửa business logic
- Dễ mock trong unit tests
- Không áp dụng cho các module khác (User, Deck, Card...) — đã chạy ổn

---

## 3. Kiến Trúc Tổng Quan

```
┌──────────────────────────────────────────────────────────────────┐
│                       Frontend (Next.js)                         │
│  ┌───────────────┐  ┌────────────────┐  ┌─────────────────────┐  │
│  │  Chat Widget  │  │ Upload Document│  │ Flashcard Study UI  │  │
│  │  (SSE stream) │  │ (PDF/Text)     │  │ "Giải thích thẻ này"│  │
│  └───────┬───────┘  └───────┬────────┘  └──────────┬──────────┘  │
└──────────┼──────────────────┼──────────────────────┼─────────────┘
           │ REST + SSE       │ REST + multipart     │ REST
           ▼                  ▼                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                     NestJS Modular Monolith                      │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                   ChatbotModule (MỚI)                     │   │
│  │                                                           │   │
│  │  ┌──────────────────┐    ┌──────────────────────────────┐ │   │
│  │  │  ChatController  │    │      ChatbotService          │ │   │
│  │  │  POST /messages  │───▶│  - sendMessage()             │ │   │
│  │  │  POST /generate  │    │  - handleGenerate()          │ │   │
│  │  │  GET /history    │    │  - getConversations()        │ │   │
│  │  │  SSE /stream     │    │                              │ │   │
│  │  └──────────────────┘    └──────────┬───────────────────┘ │   │
│  │                                     │                     │   │
│  │                          ┌──────────▼───────────────────┐ │   │
│  │                          │   IAiProvider (Interface)     │ │   │
│  │                          │   - chat()                   │ │   │
│  │                          │   - generateFlashcards()     │ │   │
│  │                          │   - generateTitle()          │ │   │
│  │                          └──────────┬───────────────────┘ │   │
│  │                                     │                     │   │
│  │                          ┌──────────▼───────────────────┐ │   │
│  │                          │   GeminiProvider (Concrete)   │ │   │
│  │                          │   implements IAiProvider      │ │   │
│  │                          │   uses @google/generative-ai  │ │   │
│  │                          └──────────────────────────────┘ │   │
│  │                                                           │   │
│  │  ┌──────────────────────────────────────────────────────┐ │   │
│  │  │   FlashcardGenerateProcessor (BullMQ Worker)         │ │   │
│  │  │   - Lắng nghe queue "flashcard-generate"             │ │   │
│  │  │   - Gọi IAiProvider.generateFlashcards()             │ │   │
│  │  │   - Tạo Deck + Bulk Insert Cards                     │ │   │
│  │  │   - Update AiGenerationJob status                    │ │   │
│  │  └──────────────────────────────────────────────────────┘ │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐   │
│  │ AiGenerator  │ │  Deck    │ │  Card    │ │  Study         │   │
│  │ Module       │ │  Module  │ │  Module  │ │  Module        │   │
│  │ (có sẵn)     │ │ (có sẵn) │ │ (có sẵn) │ │ (có sẵn)       │   │
│  └──────────────┘ └──────────┘ └──────────┘ └────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
           │              │                │
           ▼              ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│   MongoDB    │  │    Redis     │  │  Google Gemini   │
│  (data chính)│  │  (queue +    │  │  API             │
│  - users     │  │   rate limit │  │  - gemini-2.0-   │
│  - decks     │  │   + cache)   │  │    flash         │
│  - cards     │  │              │  │                  │
│  - chat_*    │  │  BullMQ:     │  │  Capabilities:   │
│  - ai_*      │  │  - generate  │  │  - Text gen      │
│              │  │    queue     │  │  - JSON mode     │
│              │  │  - retry     │  │  - Multi-turn    │
│              │  │  - delayed   │  │    chat          │
└──────────────┘  └──────────────┘  └──────────────────┘
```

---

## 4. Database Schema Mới

### 4.1. Schema: `ChatConversation`

```typescript
// src/modules/chatbot/schemas/chat-conversation.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ChatConversationDocument = ChatConversation & Document;

@Schema({ timestamps: true, collection: 'chat_conversations' })
export class ChatConversation {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 200 })
  title: string;
  // Tự động sinh từ tin nhắn đầu tiên, hoặc AI tóm tắt sau đó

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Deck' })
  deckId?: MongooseSchema.Types.ObjectId;
  // Nếu conversation gắn với 1 deck cụ thể → AI có context flashcard

  @Prop({
    default: 'general',
    enum: ['general', 'deck_chat', 'generate'],
  })
  type: string;
  // general: chat tự do
  // deck_chat: chat liên quan đến deck, AI được inject flashcard context
  // generate: conversation chứa yêu cầu tạo flashcard

  @Prop({ default: 0 })
  messageCount: number;
  // Denormalized counter — tránh count query mỗi lần load list

  @Prop({ type: Date })
  lastMessageAt?: Date;
  // Sắp xếp conversations theo tin nhắn mới nhất

  @Prop({ default: false })
  isArchived: boolean;
}

export const ChatConversationSchema =
  SchemaFactory.createForClass(ChatConversation);

// Index: lấy conversations mới nhất của user
ChatConversationSchema.index({ userId: 1, lastMessageAt: -1 });
// Index: lấy conversations theo deck
ChatConversationSchema.index({ userId: 1, deckId: 1 });
```

### 4.2. Schema: `ChatMessage`

```typescript
// src/modules/chatbot/schemas/chat-message.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ChatMessageDocument = ChatMessage & Document;

@Schema({ _id: false })
class MessageMetadata {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Deck' })
  generatedDeckId?: MongooseSchema.Types.ObjectId;
  // Deck được tạo ra từ tin nhắn này (nếu là generate)

  @Prop()
  generatedCardCount?: number;
  // Số flashcard đã generate

  @Prop({ enum: ['text', 'pdf', 'url', 'image'] })
  sourceType?: string;
  // Loại nguồn tài liệu đã xử lý

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'AiGenerationJob' })
  jobId?: MongooseSchema.Types.ObjectId;
  // Liên kết với AiGenerationJob để track status

  @Prop()
  inputTokens?: number;

  @Prop()
  outputTokens?: number;
}

@Schema({
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'chat_messages',
})
export class ChatMessage {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'ChatConversation',
    required: true,
    index: true,
  })
  conversationId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, enum: ['user', 'assistant', 'system'] })
  role: string;

  @Prop({ required: true, maxlength: 50000 })
  content: string;

  @Prop({ type: MessageMetadata })
  metadata?: MessageMetadata;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

// Index: lấy messages theo conversation, sorted by time
ChatMessageSchema.index({ conversationId: 1, createdAt: 1 });
```

### 4.3. Quan hệ giữa các collection

```
┌─────────────────────────────────────────────────────────────┐
│                    Quan hệ DB mới + cũ                      │
│                                                             │
│  users ──1:N──▶ chat_conversations ──1:N──▶ chat_messages   │
│    │                    │                        │           │
│    │                    │ (deckId?)               │ (jobId?) │
│    │                    ▼                        ▼           │
│    │              decks ◀──────────── ai_generation_jobs     │
│    │                │                        │              │
│    │                │ 1:N                    │ N:1          │
│    │                ▼                        ▼              │
│    │              cards ◀─(aiJobId)── ai_sources            │
│    │                │                                       │
│    │                │ 1:1 per user                          │
│    │                ▼                                       │
│    └──1:N──▶ card_progress                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. IAiProvider — Abstract AI Layer

Đây là phần **hexagonal** duy nhất cần thêm. Interface này cho phép:
- Swap Gemini ↔ OpenAI mà **không sửa ChatbotService**
- Mock trong unit tests dễ dàng
- Tách biệt business logic khỏi vendor SDK

```typescript
// src/modules/chatbot/interfaces/ai-provider.interface.ts

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface GeneratedCard {
  front: string;
  back: string;
  hint?: string;
  explanation?: string;
  examples?: string[];
}

export interface GenerateFlashcardsOptions {
  cardCount: number;
  difficulty: 'easy' | 'medium' | 'hard';
  language: string;
}

export interface AiChatResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AiGenerateResponse {
  cards: GeneratedCard[];
  inputTokens: number;
  outputTokens: number;
}

export interface IAiProvider {
  /**
   * Chat tự do hoặc có context flashcard
   * @param systemPrompt - System instructions
   * @param history - Lịch sử chat gần nhất (max 10-20 messages)
   * @param userMessage - Tin nhắn mới của user
   */
  chat(
    systemPrompt: string,
    history: ChatMessage[],
    userMessage: string,
  ): Promise<AiChatResponse>;

  /**
   * Generate flashcards từ nội dung text
   * @param content - Nội dung tài liệu (đã extract từ PDF/URL)
   * @param options - cardCount, difficulty, language
   */
  generateFlashcards(
    content: string,
    options: GenerateFlashcardsOptions,
  ): Promise<AiGenerateResponse>;

  /**
   * Tự động sinh tiêu đề cho conversation từ tin nhắn đầu tiên
   */
  generateTitle(firstMessage: string): Promise<string>;
}

// Injection token
export const AI_PROVIDER = Symbol('AI_PROVIDER');
```

---

## 6. GeminiProvider — Implementation

```typescript
// src/modules/chatbot/providers/gemini.provider.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  GenerativeModel,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';
import {
  IAiProvider,
  ChatMessage,
  AiChatResponse,
  AiGenerateResponse,
  GenerateFlashcardsOptions,
} from '../interfaces/ai-provider.interface';
import {
  SYSTEM_PROMPT_CHAT,
  SYSTEM_PROMPT_GENERATE,
  SYSTEM_PROMPT_TITLE,
} from '../constants/prompts';

@Injectable()
export class GeminiProvider implements IAiProvider, OnModuleInit {
  private readonly logger = new Logger(GeminiProvider.name);
  private model: GenerativeModel;
  private genAI: GoogleGenerativeAI;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.getOrThrow<string>('GEMINI_API_KEY');
    const modelName = this.configService.get<string>(
      'GEMINI_MODEL',
      'gemini-2.0-flash',
    );

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: modelName,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
      ],
    });

    this.logger.log(`GeminiProvider initialized with model: ${modelName}`);
  }

  async chat(
    systemPrompt: string,
    history: ChatMessage[],
    userMessage: string,
  ): Promise<AiChatResponse> {
    const chat = this.model.startChat({
      systemInstruction: systemPrompt,
      history: history.map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })),
    });

    const result = await chat.sendMessage(userMessage);
    const response = result.response;
    const usage = response.usageMetadata;

    return {
      content: response.text(),
      inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens: usage?.candidatesTokenCount ?? 0,
    };
  }

  async generateFlashcards(
    content: string,
    options: GenerateFlashcardsOptions,
  ): Promise<AiGenerateResponse> {
    const prompt = this.buildGeneratePrompt(content, options);

    const result = await this.model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: SYSTEM_PROMPT_GENERATE,
      generationConfig: {
        responseMimeType: 'application/json',
        // Gemini JSON mode: đảm bảo output là valid JSON
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    });

    const response = result.response;
    const usage = response.usageMetadata;
    const jsonText = response.text();

    // Parse & validate JSON output
    const cards = this.parseFlashcardsResponse(jsonText);

    return {
      cards,
      inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens: usage?.candidatesTokenCount ?? 0,
    };
  }

  async generateTitle(firstMessage: string): Promise<string> {
    const result = await this.model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: firstMessage }],
        },
      ],
      systemInstruction: SYSTEM_PROMPT_TITLE,
      generationConfig: {
        maxOutputTokens: 50,
        temperature: 0.3,
      },
    });

    return result.response.text().trim().slice(0, 200);
  }

  // ──── Private Helpers ────

  private buildGeneratePrompt(
    content: string,
    options: GenerateFlashcardsOptions,
  ): string {
    return [
      `Hãy tạo ${options.cardCount} flashcards từ nội dung sau.`,
      `Mức độ khó: ${options.difficulty}`,
      `Ngôn ngữ: ${options.language}`,
      ``,
      `--- NỘI DUNG TÀI LIỆU ---`,
      content.slice(0, 30000), // Truncate to 30k chars
      `--- HẾT NỘI DUNG ---`,
    ].join('\n');
  }

  private parseFlashcardsResponse(jsonText: string): GeneratedCard[] {
    try {
      const parsed = JSON.parse(jsonText);
      const cards: unknown[] = Array.isArray(parsed)
        ? parsed
        : parsed.cards ?? parsed.flashcards ?? [];

      return cards.map((card: any, index: number) => ({
        front: String(card.front || card.question || `Card ${index + 1}`),
        back: String(card.back || card.answer || ''),
        hint: card.hint ? String(card.hint) : undefined,
        explanation: card.explanation ? String(card.explanation) : undefined,
        examples: Array.isArray(card.examples)
          ? card.examples.map(String)
          : undefined,
      }));
    } catch (error) {
      this.logger.error(`Failed to parse Gemini response: ${jsonText}`);
      throw new Error('AI trả về dữ liệu không hợp lệ. Vui lòng thử lại.');
    }
  }
}
```

### Đăng ký Provider với NestJS DI

```typescript
// Trong chatbot.module.ts
providers: [
  {
    provide: AI_PROVIDER,
    useClass: GeminiProvider,
  },
  ChatbotService,
  // ...
],
```

### Sử dụng trong Service

```typescript
// Trong chatbot.service.ts
constructor(
  @Inject(AI_PROVIDER)
  private readonly aiProvider: IAiProvider,
) {}
```

**Lợi ích**: Nếu sau này muốn đổi sang OpenAI, chỉ cần tạo `OpenAiProvider implements IAiProvider` và đổi `useClass` trong module — **zero thay đổi** ở service/controller.

---

## 7. Redis & BullMQ — Job Queue

### 7.1. Tại sao dùng BullMQ thay vì xử lý đồng bộ?

| Vấn đề xử lý đồng bộ | BullMQ giải quyết |
|---|---|
| Gemini API mất 5-30 giây → HTTP timeout | Job chạy background, frontend poll status |
| Nếu Gemini lỗi → user mất hết progress | Auto retry 3 lần với exponential backoff |
| 10 user cùng generate → server nghẽn | Concurrency control: tối đa 3 jobs đồng thời |
| Không biết job đang ở bước nào | Job events: progress tracking real-time |

### 7.2. Redis Module Setup

```typescript
// src/modules/chatbot/chatbot.module.ts
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: configService.get('REDIS_HOST', 'localhost'),
        port: configService.get('REDIS_PORT', 6379),
        password: configService.get('REDIS_PASSWORD', undefined),
      },
    }),
    BullModule.registerQueue({
      name: 'flashcard-generate',
      defaultJobOptions: {
        attempts: 3,                    // Retry 3 lần nếu fail
        backoff: {
          type: 'exponential',
          delay: 2000,                  // 2s → 4s → 8s
        },
        removeOnComplete: {
          age: 86400,                   // Xóa job hoàn thành sau 24h
          count: 100,                   // Giữ tối đa 100 jobs
        },
        removeOnFail: {
          age: 604800,                  // Giữ failed jobs 7 ngày để debug
        },
      },
    }),
    // ... other imports
  ],
})
```

### 7.3. Queue Producer (trong ChatbotService)

```typescript
// src/modules/chatbot/chatbot.service.ts
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class ChatbotService {
  constructor(
    @InjectQueue('flashcard-generate')
    private readonly generateQueue: Queue,
    // ...
  ) {}

  async queueFlashcardGeneration(params: {
    userId: string;
    sourceId: string;
    jobId: string;       // AiGenerationJob._id
    content: string;     // Extracted text
    options: GenerateFlashcardsOptions;
    conversationId?: string;
    deckTitle: string;
  }) {
    const bullJob = await this.generateQueue.add(
      'generate',          // Job name
      params,              // Job data
      {
        jobId: params.jobId, // Dùng AiGenerationJob._id làm BullMQ jobId → dedup
        priority: 1,
      },
    );

    return bullJob;
  }
}
```

### 7.4. Queue Consumer (Processor)

```typescript
// src/modules/chatbot/processors/flashcard-generate.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AI_PROVIDER, IAiProvider } from '../interfaces/ai-provider.interface';
import { AiGeneratorRepository } from '../../ai-generator/ai-generator.repository';
import { DeckService } from '../../deck/deck.service';
import { CardService } from '../../card/card.service';
import { ChatbotRepository } from '../chatbot.repository';

@Processor('flashcard-generate', {
  concurrency: 3,       // Tối đa 3 jobs chạy đồng thời
  limiter: {
    max: 10,             // Tối đa 10 jobs/phút (bảo vệ Gemini rate limit)
    duration: 60000,
  },
})
export class FlashcardGenerateProcessor extends WorkerHost {
  private readonly logger = new Logger(FlashcardGenerateProcessor.name);

  constructor(
    @Inject(AI_PROVIDER) private readonly aiProvider: IAiProvider,
    private readonly aiGeneratorRepo: AiGeneratorRepository,
    private readonly deckService: DeckService,
    private readonly cardService: CardService,
    private readonly chatbotRepo: ChatbotRepository,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { userId, jobId, content, options, conversationId, deckTitle } =
      job.data;

    this.logger.log(`Processing flashcard generation job: ${jobId}`);

    try {
      // 1. Update job status → running
      await this.aiGeneratorRepo.updateJobStatus(jobId, 'running');
      await job.updateProgress(10);

      // 2. Gọi AI generate flashcards
      const aiResult = await this.aiProvider.generateFlashcards(
        content,
        options,
      );
      await job.updateProgress(60);

      // 3. Tạo Deck mới (sourceType: 'ai')
      const deck = await this.deckService.createDeck(
        {
          title: deckTitle,
          description: `Bộ flashcard được tạo bởi AI từ tài liệu`,
          tags: ['ai-generated'],
        },
        userId,
      );
      await job.updateProgress(70);

      // 4. Bulk insert Cards
      const cardsToInsert = aiResult.cards.map((card, index) => ({
        deckId: deck._id,
        front: card.front,
        back: card.back,
        hint: card.hint,
        explanation: card.explanation,
        examples: card.examples ?? [],
        position: index,
      }));

      await this.cardService.createBulkCards(
        { cards: cardsToInsert },
        userId,
      );
      await job.updateProgress(90);

      // 5. Update AiGenerationJob → done
      await this.aiGeneratorRepo.updateJobStatus(jobId, 'done');
      // Cũng update usage tokens
      // await this.aiGeneratorRepo.updateJobUsage(jobId, {
      //   inputTokens: aiResult.inputTokens,
      //   outputTokens: aiResult.outputTokens,
      // });

      // 6. Nếu có conversationId → gửi tin nhắn thông báo hoàn thành
      if (conversationId) {
        await this.chatbotRepo.createMessage({
          conversationId,
          role: 'assistant',
          content: `✅ Đã tạo xong bộ flashcard **"${deckTitle}"** gồm ${aiResult.cards.length} thẻ! Bạn có thể bắt đầu ôn tập ngay.`,
          metadata: {
            generatedDeckId: deck._id,
            generatedCardCount: aiResult.cards.length,
            inputTokens: aiResult.inputTokens,
            outputTokens: aiResult.outputTokens,
          },
        });
      }

      await job.updateProgress(100);
      this.logger.log(
        `✅ Job ${jobId} completed: ${aiResult.cards.length} cards generated`,
      );
    } catch (error) {
      this.logger.error(`❌ Job ${jobId} failed: ${error.message}`);
      await this.aiGeneratorRepo.updateJobStatus(
        jobId,
        'failed',
        error.message,
      );
      throw error; // BullMQ sẽ retry
    }
  }
}
```

### 7.5. Redis cho Response Cache (Optional)

```typescript
// src/modules/chatbot/services/ai-cache.service.ts
import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import Redis from 'ioredis';

@Injectable()
export class AiCacheService {
  private redis: Redis;
  private readonly TTL = 7200; // 2 giờ

  constructor(configService: ConfigService) {
    this.redis = new Redis(configService.get('REDIS_URL'));
  }

  private buildKey(content: string, options: object): string {
    const hash = createHash('sha256')
      .update(content + JSON.stringify(options))
      .digest('hex')
      .slice(0, 16);
    return `ai:cache:${hash}`;
  }

  async getCachedResponse(content: string, options: object): Promise<string | null> {
    return this.redis.get(this.buildKey(content, options));
  }

  async setCachedResponse(content: string, options: object, response: string): Promise<void> {
    await this.redis.setex(this.buildKey(content, options), this.TTL, response);
  }
}
```

---

## 8. ChatbotService — Business Logic

```typescript
// src/modules/chatbot/chatbot.service.ts

@Injectable()
export class ChatbotService {
  private readonly MAX_HISTORY = 20;       // Max messages gửi cho AI context
  private readonly MAX_CARD_CONTEXT = 50;  // Max cards inject vào context

  constructor(
    @Inject(AI_PROVIDER) private readonly aiProvider: IAiProvider,
    @InjectQueue('flashcard-generate') private readonly generateQueue: Queue,
    private readonly chatbotRepo: ChatbotRepository,
    private readonly cardService: CardService,
    private readonly deckService: DeckService,
    private readonly aiGeneratorRepo: AiGeneratorRepository,
  ) {}

  // ──── Conversation CRUD ────

  async createConversation(userId: string, dto: CreateConversationDto) {
    return this.chatbotRepo.createConversation({
      userId,
      title: dto.title ?? 'Cuộc hội thoại mới',
      deckId: dto.deckId,
      type: dto.deckId ? 'deck_chat' : 'general',
    });
  }

  async getConversations(userId: string, page: number, limit: number) {
    return this.chatbotRepo.findConversationsByUser(userId, page, limit);
  }

  async getConversationMessages(
    conversationId: string,
    userId: string,
    page: number,
    limit: number,
  ) {
    const conversation = await this.getOwnedConversation(conversationId, userId);
    return this.chatbotRepo.findMessages(conversationId, page, limit);
  }

  async archiveConversation(conversationId: string, userId: string) {
    await this.getOwnedConversation(conversationId, userId);
    return this.chatbotRepo.archiveConversation(conversationId);
  }

  // ──── Chat Core ────

  async sendMessage(
    conversationId: string,
    userId: string,
    content: string,
  ) {
    const conversation = await this.getOwnedConversation(conversationId, userId);

    // 1. Lưu user message
    await this.chatbotRepo.createMessage({
      conversationId,
      role: 'user',
      content,
    });

    // 2. Build context
    const history = await this.chatbotRepo.findRecentMessages(
      conversationId,
      this.MAX_HISTORY,
    );

    let systemPrompt = SYSTEM_PROMPT_CHAT;

    // 3. Inject flashcard context nếu conversation gắn với deck
    if (conversation.deckId) {
      const cards = await this.cardService.findByDeckId(
        conversation.deckId.toString(),
      );
      const cardContext = cards
        .slice(0, this.MAX_CARD_CONTEXT)
        .map(
          (c, i) =>
            `Thẻ ${i + 1}:\n  Mặt trước: ${c.front}\n  Mặt sau: ${c.back}` +
            (c.explanation ? `\n  Giải thích: ${c.explanation}` : ''),
        )
        .join('\n\n');

      systemPrompt += `\n\n--- FLASHCARD CONTEXT (Bộ thẻ hiện tại) ---\n${cardContext}\n--- HẾT CONTEXT ---`;
    }

    // 4. Gọi AI
    const aiResponse = await this.aiProvider.chat(
      systemPrompt,
      history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      content,
    );

    // 5. Lưu assistant message
    const assistantMessage = await this.chatbotRepo.createMessage({
      conversationId,
      role: 'assistant',
      content: aiResponse.content,
      metadata: {
        inputTokens: aiResponse.inputTokens,
        outputTokens: aiResponse.outputTokens,
      },
    });

    // 6. Update conversation metadata
    await this.chatbotRepo.updateConversationMeta(conversationId, {
      lastMessageAt: new Date(),
      $inc: { messageCount: 2 }, // user + assistant
    });

    // 7. Auto-generate title nếu là tin nhắn đầu tiên
    if (conversation.messageCount === 0) {
      const title = await this.aiProvider.generateTitle(content);
      await this.chatbotRepo.updateConversationTitle(conversationId, title);
    }

    return {
      message: assistantMessage,
      usage: {
        inputTokens: aiResponse.inputTokens,
        outputTokens: aiResponse.outputTokens,
      },
    };
  }

  // ──── Generate Flashcards ────

  async generateFlashcards(userId: string, dto: GenerateFlashcardsDto) {
    // 1. Parse content
    let extractedText: string;

    if (dto.type === 'text') {
      extractedText = dto.rawText!;
    } else if (dto.type === 'pdf') {
      // PDF parsing sẽ được handle ở controller level (multer + pdf-parse)
      extractedText = dto.extractedText!;
    } else {
      throw new BadRequestException('Unsupported source type');
    }

    // 2. Tạo AiSource
    const source = await this.aiGeneratorRepo.createSource({
      type: dto.type,
      title: dto.title,
      rawText: dto.type === 'text' ? extractedText : undefined,
      extractedText,
    }, userId);

    // 3. Tạo AiGenerationJob
    const job = await this.aiGeneratorRepo.createJob({
      userId,
      sourceId: source._id.toString(),
      prompt: `Generate ${dto.cardCount ?? 10} flashcards`,
      cardCount: dto.cardCount,
      difficulty: dto.difficulty,
      language: dto.language,
    });

    // 4. Đẩy vào BullMQ queue
    await this.queueFlashcardGeneration({
      userId,
      sourceId: source._id.toString(),
      jobId: job._id.toString(),
      content: extractedText,
      options: {
        cardCount: dto.cardCount ?? 10,
        difficulty: dto.difficulty ?? 'medium',
        language: dto.language ?? 'vi',
      },
      conversationId: dto.conversationId,
      deckTitle: dto.title,
    });

    // 5. Trả về ngay lập tức (job chạy background)
    return {
      jobId: job._id.toString(),
      status: 'queued',
      message: `Đang xử lý tạo flashcard từ "${dto.title}". Bạn sẽ nhận được thông báo khi hoàn thành.`,
    };
  }

  async getJobStatus(jobId: string, userId: string) {
    const job = await this.aiGeneratorRepo.findJobById(jobId);

    if (!job || job.userId.toString() !== userId) {
      throw new NotFoundException('Job not found');
    }

    return {
      jobId: job._id.toString(),
      status: job.status,
      targetDeckId: job.targetDeckId?.toString(),
      errorMessage: job.errorMessage,
      finishedAt: job.finishedAt,
    };
  }

  // ──── Private Helpers ────

  private async getOwnedConversation(conversationId: string, userId: string) {
    const conversation = await this.chatbotRepo.findConversationById(conversationId);

    if (!conversation || conversation.userId.toString() !== userId) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }
}
```

---

## 9. Prompt Engineering

```typescript
// src/modules/chatbot/constants/prompts.ts

export const SYSTEM_PROMPT_CHAT = `
Bạn là Quizzy AI — trợ lý học tập thông minh chuyên về flashcard và ôn thi.

## Vai trò
- Giải thích nội dung flashcard khi user hỏi (nếu có context flashcard)
- Đặt câu hỏi kiểm tra kiến thức dựa trên nội dung flashcard
- Gợi ý mẹo ghi nhớ (mnemonics, liên tưởng, ví dụ thực tế)
- Trả lời câu hỏi học thuật tổng quát
- Khi user muốn tạo flashcard mới → hướng dẫn họ dùng tính năng Generate

## Quy tắc
1. Trả lời ngắn gọn, dễ hiểu, tập trung vào trọng tâm
2. Nếu có FLASHCARD CONTEXT → ưu tiên trả lời dựa trên nội dung đó
3. Sử dụng emoji phù hợp để tăng tính thân thiện
4. Khi giải thích → dùng ví dụ thực tế, so sánh dễ hiểu
5. Trả lời bằng ngôn ngữ mà user sử dụng (tự detect)
6. KHÔNG bịa đặt thông tin. Nếu không chắc → nói rõ
7. Format câu trả lời bằng Markdown khi cần thiết (bold, list, code block)
`;

export const SYSTEM_PROMPT_GENERATE = `
Bạn là chuyên gia tạo flashcard học tập chất lượng cao.

## Nhiệm vụ
Phân tích tài liệu được cung cấp và tạo flashcard theo yêu cầu.

## Output Format
Trả về JSON array, mỗi phần tử có cấu trúc:
{
  "front": "Câu hỏi / thuật ngữ — ngắn gọn, rõ ràng, một vấn đề duy nhất",
  "back": "Câu trả lời / định nghĩa — chính xác, súc tích, dễ nhớ",
  "hint": "Gợi ý nhẹ giúp nhớ lại (optional, 1 câu ngắn)",
  "explanation": "Giải thích chi tiết, bối cảnh, hoặc tại sao đáp án đúng",
  "examples": ["Ví dụ 1 thực tế", "Ví dụ 2 minh họa"]
}

## Quy tắc tạo flashcard
1. **Chính xác**: Nội dung phải trung thành với tài liệu gốc, KHÔNG bịa đặt
2. **Đa dạng câu hỏi**: Kết hợp nhiều loại:
   - Định nghĩa: "X là gì?"
   - So sánh: "Sự khác biệt giữa A và B?"
   - Ứng dụng: "Khi nào nên dùng X?"
   - Nguyên nhân: "Tại sao X xảy ra?"
   - Liệt kê: "Kể tên 3 đặc điểm của X"
3. **Atomic**: Mỗi thẻ chỉ kiểm tra MỘT kiến thức duy nhất
4. **Phù hợp độ khó**:
   - easy: Ghi nhớ, nhận biết
   - medium: Hiểu, áp dụng
   - hard: Phân tích, so sánh, đánh giá
5. **Ngôn ngữ**: Sử dụng ngôn ngữ theo yêu cầu
6. **Hint**: Nên là gợi ý gián tiếp (chữ cái đầu, liên tưởng), KHÔNG phải đáp án

## Ví dụ tốt
Front: "HTTP Status Code 404 nghĩa là gì?"
Back: "Not Found — Tài nguyên được yêu cầu không tồn tại trên server"
Hint: "Nghĩ đến khi bạn gõ sai URL..."
Explanation: "Server nhận được request nhưng không tìm thấy resource tương ứng. Khác với 403 (bị cấm) và 500 (lỗi server)."
Examples: ["Truy cập /api/users/999 khi user 999 không tồn tại", "Gõ URL sai chính tả"]
`;

export const SYSTEM_PROMPT_TITLE = `
Tạo tiêu đề ngắn gọn (tối đa 50 ký tự) cho cuộc hội thoại dựa trên tin nhắn đầu tiên.
Chỉ trả về tiêu đề, không thêm dấu ngoặc kép hay giải thích.
Ví dụ: "Ôn tập JavaScript cơ bản", "Giải thích thuật toán SRS", "Flashcard Sinh học lớp 12"
`;
```

---

## 10. Luồng Xử Lý Chi Tiết

### Luồng 1: Chat thông minh (đồng bộ)

```
User gửi tin nhắn
    │
    ▼
ChatController.sendMessage(conversationId, { content })
    │
    ▼
ChatbotService.sendMessage()
    │
    ├── 1. Lưu user message vào chat_messages
    │
    ├── 2. Load 20 messages gần nhất (history)
    │
    ├── 3. Conversation có deckId?
    │       ├── CÓ → CardService.findByDeckId()
    │       │        → Inject max 50 cards vào system prompt
    │       └── KHÔNG → Dùng system prompt mặc định
    │
    ├── 4. IAiProvider.chat(systemPrompt, history, userMessage)
    │       └── GeminiProvider gọi Gemini API
    │           └── Trả về { content, inputTokens, outputTokens }
    │
    ├── 5. Lưu assistant message vào chat_messages (kèm token metadata)
    │
    ├── 6. Update conversation (lastMessageAt, messageCount++)
    │
    ├── 7. Nếu messageCount === 0 → IAiProvider.generateTitle()
    │       └── Update conversation.title
    │
    └── 8. Trả response { message, usage }

Thời gian response: ~1-3 giây (Gemini 2.0 Flash rất nhanh)
```

### Luồng 2: Generate Flashcard (bất đồng bộ qua BullMQ)

```
User gửi yêu cầu generate
    │
    ▼
ChatController.generateFlashcards({ type, rawText/file, title, options })
    │
    ├── Nếu type='pdf' → Multer upload → pdf-parse extract text
    │
    ▼
ChatbotService.generateFlashcards()
    │
    ├── 1. Tạo AiSource (status: 'parsed')
    │
    ├── 2. Tạo AiGenerationJob (status: 'queued')
    │
    ├── 3. generateQueue.add('generate', jobData)
    │       └── Đẩy vào Redis BullMQ queue
    │
    └── 4. Trả response ngay: { jobId, status: 'queued' }
            └── Frontend bắt đầu poll GET /jobs/:id

    ═══════════════════════════════════════════
    ║           BACKGROUND (BullMQ Worker)     ║
    ═══════════════════════════════════════════

FlashcardGenerateProcessor.process(job)
    │
    ├── 1. Update AiGenerationJob → 'running'
    │
    ├── 2. IAiProvider.generateFlashcards(content, options)
    │       └── GeminiProvider gọi Gemini API (JSON mode)
    │           └── Trả về { cards[], inputTokens, outputTokens }
    │
    ├── 3. Parse & validate JSON response
    │       └── Nếu invalid → throw → BullMQ retry (max 3 lần)
    │
    ├── 4. DeckService.createDeck({ title, sourceType: 'ai' })
    │
    ├── 5. CardService.createBulkCards(cards)
    │       └── Mỗi card có aiJobId liên kết
    │
    ├── 6. Update AiGenerationJob → 'done' + usage info
    │
    ├── 7. Nếu có conversationId:
    │       └── Gửi ChatMessage thông báo hoàn thành
    │           └── metadata: { generatedDeckId, generatedCardCount }
    │
    └── 8. Done! Frontend poll thấy status='done' → redirect đến deck
```

### Luồng 3: Giải thích thẻ từ giao diện ôn tập

```
User đang study deck → bấm "Giải thích thẻ này"
    │
    ▼
Frontend gọi POST /v1/chatbot/conversations
    với { deckId, title: "Giải thích: [card.front]" }
    │
    ▼
Frontend gọi POST /v1/chatbot/conversations/:id/messages
    với { content: "Giải thích chi tiết thẻ: [card.front] → [card.back]" }
    │
    ▼
ChatbotService tự động inject deck context
    → AI giải thích dựa trên nội dung toàn bộ deck
    → Trả response chi tiết với ví dụ, so sánh, mẹo nhớ
```

---

## 11. API Endpoints

### 11.1. Conversation APIs

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| `POST` | `/v1/chatbot/conversations` | JWT | Tạo conversation mới (có thể gắn deckId) |
| `GET` | `/v1/chatbot/conversations` | JWT | Danh sách conversations của user (paginated, sorted by lastMessageAt) |
| `GET` | `/v1/chatbot/conversations/:id` | JWT | Chi tiết conversation + messages (paginated) |
| `PATCH` | `/v1/chatbot/conversations/:id` | JWT | Update title, archive |
| `DELETE` | `/v1/chatbot/conversations/:id` | JWT | Soft delete conversation |

### 11.2. Message APIs

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| `POST` | `/v1/chatbot/conversations/:id/messages` | JWT | Gửi tin nhắn → nhận AI response (đồng bộ) |
| `GET` | `/v1/chatbot/conversations/:id/messages` | JWT | Lấy messages (paginated, cursor-based) |

### 11.3. Generate APIs

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| `POST` | `/v1/chatbot/generate/text` | JWT | Generate flashcards từ raw text |
| `POST` | `/v1/chatbot/generate/pdf` | JWT | Upload PDF + generate flashcards (multipart) |
| `GET` | `/v1/chatbot/generate/jobs/:id` | JWT | Poll trạng thái job |

---

## 12. DTOs Chi Tiết

```typescript
// ──── Conversation DTOs ────

// dto/create-conversation.dto.ts
export class CreateConversationDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsMongoId()
  @IsOptional()
  deckId?: string;
  // Nếu có → conversation type = 'deck_chat', AI sẽ có flashcard context
}

// dto/update-conversation.dto.ts
export class UpdateConversationDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsBoolean()
  @IsOptional()
  isArchived?: boolean;
}

// ──── Message DTOs ────

// dto/send-message.dto.ts
export class SendMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Nội dung tin nhắn không được để trống' })
  @MaxLength(2000, { message: 'Tin nhắn tối đa 2000 ký tự' })
  content: string;
}

// ──── Generate DTOs ────

// dto/generate-flashcards.dto.ts
export class GenerateFlashcardsTextDto {
  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty({ message: 'Nội dung tài liệu không được để trống' })
  @MaxLength(50000, { message: 'Nội dung tối đa 50.000 ký tự' })
  rawText: string;

  @IsInt()
  @Min(5, { message: 'Tối thiểu 5 flashcards' })
  @Max(30, { message: 'Tối đa 30 flashcards' })
  @IsOptional()
  cardCount?: number; // default: 10

  @IsEnum(['easy', 'medium', 'hard'])
  @IsOptional()
  difficulty?: string; // default: 'medium'

  @IsString()
  @IsOptional()
  language?: string; // default: 'vi'

  @IsMongoId()
  @IsOptional()
  conversationId?: string;
  // Nếu có → kết quả generate sẽ được gửi như ChatMessage trong conversation này
}

// dto/generate-flashcards-pdf.dto.ts
// (PDF file được gửi qua multipart form-data, các field khác giống text)
export class GenerateFlashcardsPdfDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

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

  @IsMongoId()
  @IsOptional()
  conversationId?: string;
}

// ──── Query DTOs ────

// dto/query-conversations.dto.ts
export class QueryConversationsDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 20;
}

// dto/query-messages.dto.ts
export class QueryMessagesDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 50;
}
```

---

## 13. Cấu Trúc File

```
src/modules/chatbot/
│
├── chatbot.module.ts                 # Module chính, đăng ký BullMQ, providers
├── chatbot.controller.ts             # REST endpoints
├── chatbot.service.ts                # Business logic
├── chatbot.repository.ts             # MongoDB queries cho chat_conversations, chat_messages
│
├── interfaces/
│   └── ai-provider.interface.ts      # IAiProvider interface + injection token
│
├── providers/
│   └── gemini.provider.ts            # GeminiProvider implements IAiProvider
│   └── (openai.provider.ts)          # (Tương lai: OpenAI implementation)
│
├── processors/
│   └── flashcard-generate.processor.ts  # BullMQ worker xử lý generate jobs
│
├── services/
│   └── ai-cache.service.ts           # Redis cache cho AI responses (optional)
│   └── pdf-parser.service.ts         # Wrapper cho pdf-parse
│
├── schemas/
│   ├── chat-conversation.schema.ts   # ChatConversation schema
│   └── chat-message.schema.ts        # ChatMessage schema
│
├── dto/
│   ├── create-conversation.dto.ts
│   ├── update-conversation.dto.ts
│   ├── send-message.dto.ts
│   ├── generate-flashcards-text.dto.ts
│   ├── generate-flashcards-pdf.dto.ts
│   ├── query-conversations.dto.ts
│   └── query-messages.dto.ts
│
└── constants/
    └── prompts.ts                    # System prompts cho các use case
```

---

## 14. Cấu Hình Môi Trường

```env
# ──── .env (thêm các biến sau) ────

# Google Gemini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash

# Redis (BullMQ + Cache + Rate Limit)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=redis://localhost:6379
# Nếu dùng cloud Redis (Upstash, Redis Cloud):
# REDIS_URL=rediss://default:password@host:port

# Chatbot Config
CHATBOT_MAX_HISTORY=20
CHATBOT_MAX_CARD_CONTEXT=50
CHATBOT_MAX_INPUT_CHARS=50000

# Rate Limiting
RATE_LIMIT_CHAT_PER_MINUTE=15
RATE_LIMIT_GENERATE_PER_HOUR=5
```

```env
# ──── .env.example (update) ────

MONGODB_URI=
JWT_SECRET=
JWT_EXPIRES_IN=7d
PORT=3001
ADMIN_EMAIL=admin@quizzy.local
ADMIN_PASSWORD=change-me
ADMIN_NAME=Quizzy Admin

# AI Chatbot
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_URL=redis://localhost:6379
```

---

## 15. Bảo Mật & Rate Limiting

### 15.1. Rate Limiting Strategy

```typescript
// Sử dụng @nestjs/throttler với Redis store

// app.module.ts hoặc chatbot.module.ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'chat',
          ttl: 60000,     // 1 phút
          limit: 15,      // 15 messages/phút/user
        },
        {
          name: 'generate',
          ttl: 3600000,   // 1 giờ
          limit: 5,       // 5 generate requests/giờ/user
        },
      ],
      storage: new ThrottlerStorageRedisService(redisConnection),
    }),
  ],
})
```

```typescript
// Controller level
@Throttle({ chat: { ttl: 60000, limit: 15 } })
@Post('conversations/:id/messages')
async sendMessage() { ... }

@Throttle({ generate: { ttl: 3600000, limit: 5 } })
@Post('generate/text')
async generateFromText() { ... }
```

### 15.2. Security Checklist

| Mục | Biện pháp | Priority |
|-----|----------|----------|
| API Key exposure | `GEMINI_API_KEY` chỉ ở `.env`, KHÔNG gửi ra frontend | 🔴 Critical |
| Input validation | MaxLength trên tất cả DTOs (2000 chars chat, 50000 chars generate) | 🔴 Critical |
| Auth | JWT required trên mọi endpoint chatbot | 🔴 Critical |
| Ownership | Verify `conversation.userId === currentUser` mọi lúc | 🔴 Critical |
| Rate limiting | Redis-backed throttler per-user | 🟡 High |
| File upload | Chỉ accept PDF, max 10MB, validate MIME type | 🟡 High |
| Concurrent jobs | Max 3 running jobs/user (query `status: 'running'`) | 🟡 High |
| Output sanitization | Strip HTML tags từ AI response trước khi lưu | 🟢 Medium |
| Token budget | Track usage trong `ChatMessage.metadata` + `AiGenerationJob.usage` | 🟢 Medium |

---

## 16. Error Handling

```typescript
// src/modules/chatbot/chatbot.service.ts — Error handling patterns

// 1. Gemini API errors
try {
  const response = await this.aiProvider.chat(systemPrompt, history, message);
} catch (error) {
  if (error.message?.includes('SAFETY')) {
    throw new BadRequestException(
      'Nội dung vi phạm chính sách an toàn. Vui lòng thử lại với nội dung khác.',
    );
  }
  if (error.message?.includes('RATE_LIMIT') || error.status === 429) {
    throw new ServiceUnavailableException(
      'Hệ thống AI đang quá tải. Vui lòng thử lại sau 1 phút.',
    );
  }
  if (error.message?.includes('API_KEY')) {
    this.logger.error('Invalid Gemini API Key');
    throw new InternalServerErrorException(
      'Lỗi cấu hình hệ thống. Vui lòng liên hệ admin.',
    );
  }
  throw new InternalServerErrorException(
    'Có lỗi xảy ra khi xử lý AI. Vui lòng thử lại.',
  );
}

// 2. JSON parse errors (generate)
// Đã handle trong GeminiProvider.parseFlashcardsResponse()
// Nếu fail → BullMQ retry với exponential backoff

// 3. PDF parse errors
try {
  const pdfData = await pdfParse(buffer);
  if (!pdfData.text || pdfData.text.trim().length < 50) {
    throw new BadRequestException(
      'File PDF không chứa đủ nội dung text. Vui lòng thử file khác.',
    );
  }
} catch (error) {
  throw new BadRequestException(
    'Không thể đọc file PDF. File có thể bị hỏng hoặc được bảo vệ bằng mật khẩu.',
  );
}
```

---

## 17. Chi Phí & Giới Hạn API

### 17.1. Gemini 2.0 Flash Pricing

| Tier | Input | Output | Rate Limits |
|------|-------|--------|-------------|
| **Free** | Miễn phí | Miễn phí | 15 RPM, 1M TPM, 1500 RPD |
| **Pay-as-you-go** | $0.10/1M tokens | $0.40/1M tokens | 2000 RPM, 4M TPM |

### 17.2. Ước tính chi phí

| Tác vụ | Tokens ước tính | Chi phí (pay-as-you-go) |
|--------|----------------|------------------------|
| 1 tin nhắn chat (với context 30 cards) | ~2.000 input + 500 output | $0.0004 |
| Generate 10 flashcards từ 1 trang | ~3.000 input + 2.000 output | $0.0011 |
| Generate 30 flashcards từ 5 trang | ~8.000 input + 5.000 output | $0.0028 |
| Generate title | ~100 input + 30 output | $0.00002 |

> **Free tier đủ cho development & demo**. Với 1500 RPD (requests/day), đủ cho team dev và demo. Chỉ cần trả tiền khi scale lên production thực tế.

### 17.3. Redis Hosting (cho BullMQ)

| Nhà cung cấp | Free tier | Ghi chú |
|---|---|---|
| **Upstash** | 10.000 commands/ngày, 256MB | Serverless, phù hợp Vercel |
| **Redis Cloud** | 30MB | Cơ bản nhưng đủ dùng |
| **Localhost** | Miễn phí | Development only |

> **Khuyến nghị**: Dùng **Upstash** — serverless Redis, tương thích Vercel, free tier rộng rãi cho MVP.

---

## 18. Kế Hoạch Triển Khai Theo Phase

### Phase 1: Foundation — AI Core & Redis Setup (3 ngày)

```
Mục tiêu: Gemini hoạt động, Redis connected, schemas ready
```

- [ ] Cài đặt packages:
  ```bash
  npm install @google/generative-ai ioredis @nestjs/bullmq bullmq pdf-parse @nestjs/throttler
  npm install -D @types/multer
  ```
- [ ] Thêm env vars vào `.env` + `.env.example`
- [ ] Tạo `IAiProvider` interface (`interfaces/ai-provider.interface.ts`)
- [ ] Implement `GeminiProvider` (`providers/gemini.provider.ts`)
- [ ] Viết unit test cho GeminiProvider (mock API)
- [ ] Tạo schemas `ChatConversation` + `ChatMessage`
- [ ] Setup Redis connection trong `ChatbotModule`
- [ ] Setup BullMQ queue `flashcard-generate`
- [ ] Test: Gọi Gemini API thành công từ NestJS

### Phase 2: Chat Feature — Conversations & Messages (4 ngày)

```
Mục tiêu: User có thể chat qua lại với AI, có context flashcard
```

- [ ] Tạo `ChatbotModule` (module, controller, service, repository)
- [ ] Implement `ChatbotRepository` — CRUD conversations + messages
- [ ] Implement conversation endpoints: create, list, get, archive
- [ ] Implement `sendMessage` — chat cơ bản với Gemini
- [ ] Implement flashcard context injection (gắn cards vào system prompt)
- [ ] Implement chat history (gửi 20 tin nhắn gần nhất)
- [ ] Implement auto-generate conversation title
- [ ] Setup `@nestjs/throttler` với Redis store — rate limiting
- [ ] Test: Chat flow end-to-end qua Postman
- [ ] Update Postman collection

### Phase 3: Generate Flashcard — BullMQ Pipeline (4 ngày)

```
Mục tiêu: User gửi text/PDF → AI tạo flashcard → Deck + Cards được tạo tự động
```

- [ ] Implement `PdfParserService` — wrapper pdf-parse
- [ ] Implement `GenerateFlashcardsTextDto` + `GenerateFlashcardsPdfDto`
- [ ] Implement `ChatbotService.generateFlashcards()` — tạo source + job + queue
- [ ] Implement `FlashcardGenerateProcessor` — BullMQ worker
- [ ] Kết nối với `AiGeneratorRepository` (có sẵn): createSource, createJob, updateJobStatus
- [ ] Kết nối với `DeckService.createDeck` + `CardService.createBulkCards` (có sẵn)
- [ ] Implement `getJobStatus` endpoint — poll trạng thái
- [ ] Implement multipart file upload (Multer + PDF validation)
- [ ] Handle error cases: invalid PDF, empty content, Gemini parse error
- [ ] Test: Generate flow end-to-end qua Postman
- [ ] Update Postman collection

### Phase 4: Polish & Advanced (3 ngày)

```
Mục tiêu: Production-ready, UX tốt, monitoring
```

- [ ] Streaming response (SSE) cho chat real-time (optional)
- [ ] `AiCacheService` — cache AI responses trong Redis (optional)
- [ ] Tích hợp vào study flow: "Giải thích thẻ này" button
- [ ] Token usage dashboard (aggregate từ ChatMessage.metadata)
- [ ] Concurrent job limit: max 3 running jobs/user
- [ ] File size limit: max 10MB PDF
- [ ] Logging: structured logs cho AI calls (latency, tokens, errors)
- [ ] Error monitoring: catch & log tất cả Gemini API errors
- [ ] Update `docs/database-schema.md` với schemas mới
- [ ] Update `README.md` với hướng dẫn setup Redis + Gemini

---

## ✅ Tổng Kết

| Quyết định | Kết luận |
|---|---|
| **Gemini API** | ✅ Gemini 2.0 Flash — nhanh, rẻ, free tier rộng, JSON mode tốt |
| **Redis** | ✅ Dùng cho BullMQ job queue + rate limiting + optional cache |
| **Microservices** | ❌ Không — giữ modular monolith, NestJS modules đủ tốt |
| **Hexagonal** | ⚠️ Chỉ `IAiProvider` interface — dễ swap AI provider |
| **Database** | ✅ Schema hiện tại gần như hoàn hảo, chỉ thêm 2 collections mới |

**Tổng thời gian**: ~14 ngày (4 phases)
**Packages mới**: 6 (`@google/generative-ai`, `ioredis`, `@nestjs/bullmq`, `bullmq`, `pdf-parse`, `@nestjs/throttler`)
**Collections mới**: 2 (`chat_conversations`, `chat_messages`)
**Files mới**: ~15 files trong `src/modules/chatbot/`
