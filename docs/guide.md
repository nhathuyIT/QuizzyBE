```python
# Let's draft a complete, comprehensive, and highly structured markdown file for the NestJS architecture guideline.
# This file will act as the new 'rule.md' or 'NESTJS_ARCHITECTURE_GUIDELINES.md' that completely migrates the old Express rule to standard NestJS.

nestjs_guidelines_content = """# Quy Định Kiến Trúc Dự Án NestJS - Gizmo Clone System
Tài liệu này đóng vai trò là Guideline chính thức bắt buộc cho toàn bộ thành viên dự án khi phát triển Backend bằng NestJS kết hợp Mongoose (MongoDB), Class-Validator, và BullMQ.

---

**GHI NHỚ KHI CONTEXT CỦA BẠN ĐẠT 80% HÃY TẠO 1 file MD liệt kê bạn đã làm gì và còn gì để làm

## 1. Nguyên Tắc Tổng Quan

1. **Tuân thủ Tuyệt đối Tư duy NestJS (NestJS Way):**
   - Không cấu hình, khởi tạo thủ công bằng từ khóa `new` đối với các Service, Repository, hay Controller. Mọi cấu phần phải do **NestJS IoC Container** quản lý và thực hiện Dependency Injection (DI).
   - Loại bỏ hoàn toàn lớp `Route` thủ công kiểu Express. Sử dụng Decorators (`@Controller()`, `@Get()`, `@Post()`,...) của NestJS để định nghĩa Routing trực tiếp tại lớp Controller.

2. **Cấu trúc hướng Module (Feature Module-Based):**
   - Mỗi tên miền nghiệp vụ (Core Domain) phải nằm trọn vẹn trong một thư mục Module riêng biệt dưới đường dẫn `src/modules/<tên-module>/`.
   - Toàn bộ Schemas, DTOs, Controllers, Services, và Repositories thuộc Module nào thì bắt buộc phải nằm trong thư mục của Module đó. Không gom tập trung Schemas hay DTOs về một thư mục chung toàn hệ thống để đảm bảo tính đóng gói (Encapsulation).

3. **Luồng Đi Của Dữ Liệu (Layered Architecture):**
   - **Client/Frontend (Next.js)** $\\rightarrow$ **Controller** (Nhận Request, Validate bằng DTO, gọi Service) $\\rightarrow$ **Service** (Xử lý Business Logic, kiểm tra ràng buộc nghiệp vụ, điều phối Repository) $\\rightarrow$ **Repository** (Truy vấn database qua Mongoose Model) $\\rightarrow$ **Database (MongoDB)**.

4. **Quản lý Lỗi Tập Trung (Built-in Exception Filters):**
   - Tuyệt đối không dùng hàm `next(error)` hoặc tự ý cấu hình middleware Express để bắt lỗi.
   - Khi xảy ra lỗi nghiệp vụ, bắt buộc dùng các Exception tiêu chuẩn của NestJS (`BadRequestException`, `NotFoundException`, `InternalServerErrorException`) kết hợp mã lỗi hoặc thông báo bằng Tiếng Việt rõ ràng.

5. **Xử lý Bất đồng bộ với Tác vụ AI (Background Jobs Rule):**
   - Mọi tác vụ sinh Flashcard tự động từ các nguồn học liệu (PDF, URL, Text) bằng OpenAI/Gemini API mất nhiều thời gian xử lý (>3 giây) **bắt buộc không được chạy đồng bộ trên luồng HTTP chính**.
   - Phải áp dụng kiến trúc hàng đợi **BullMQ (Redis)** để xử lý ngầm dưới dạng Background Job.

---

## 2. Cấu Trúc Thư Mục Tiêu Chuẩn Cho Một Module

Mỗi Feature Module khi khởi tạo (ưu tiên dùng lệnh `npx nest g resource`) cần tuân thủ cấu trúc phân lớp nghiêm ngặt sau:


```

````text
File generated successfully.

```txt
src/modules/<kebab-case-module>/
  ├── dto/
  │    ├── create-<module>.dto.ts      # DTO cho dữ liệu tạo mới
  │    ├── update-<module>.dto.ts      # DTO cho dữ liệu cập nhật
  │    ├── response-<module>.dto.ts    # DTO định nghĩa cấu trúc dữ liệu trả về (Serialization)
  │    └── search-<module>.dto.ts      # DTO cho bộ lọc tìm kiếm / phân trang
  ├── schemas/
  │    └── <kebab-case-module>.schema.ts # Mongoose Schema thực thể
  ├── <kebab-case-module>.controller.ts # Chỉ xử lý HTTP Adapter (Routing, Giao tiếp)
  ├── <kebab-case-module>.service.ts    # Nơi chứa 100% Business Logic nghiệp vụ
  ├── <kebab-case-module>.repository.ts # Lớp chuyên trách tương tác trực tiếp với Database
  └── <kebab-case-module>.module.ts     # Khai báo và cấu hình liên kết dây chuyền DI

````

---

## 3. Quy Ước Đặt Tên (Naming Conventions)

- **Thư mục Module:** Dạng chữ thường nối nhau bằng dấu gạch ngang (`kebab-case`). Ví dụ: `ai-generator`, `card-progress`.
- **Tên File:** `<tên-module>.<loại-lớp>.ts` viết bằng `kebab-case`. Ví dụ: `deck.controller.ts`, `auth-user.dto.ts`.
- **Tên Lớp (Class Name):** Dạng `PascalCase` đi kèm hậu tố chức năng rõ ràng.
- Module: `DeckModule`, `CardProgressModule`
- Controller: `DeckController`
- Service: `DeckService`
- Repository: `DeckRepository`
- Schema: `Deck`, `CardProgress`
- DTO: `CreateDeckDto`, `UpdateUserDto`

---

## 4. Chi Tiết Thực Thi Các Phân Lớp (Implementation Code Standards)

### 4.1. Tầng Model / Schema (`*.schema.ts`)

- Sử dụng hoàn toàn Decorator `@Schema()`, `@Prop()`, và `SchemaFactory.createForClass()`.
- Thiết lập `timestamps: true` để MongoDB tự sinh `createdAt` và `updatedAt`.
- Bắt buộc khai báo đầy đủ thuộc tính `index: true` cho các trường hay dùng làm bộ lọc tìm kiếm hoặc làm khóa ngoại (ví dụ: `userId`, `deckId`). Các cặp ràng buộc duy nhất phải dùng `unique: true` hoặc Compound Index ở cuối file.

_Ví dụ mẫu cho `card-progress.schema.ts`:_

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type CardProgressDocument = CardProgress & Document;

@Schema({ timestamps: true })
export class CardProgress {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Card', required: true })
  cardId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Deck', required: true })
  deckId: MongooseSchema.Types.ObjectId;

  @Prop({ default: 0, min: 0, max: 100 })
  mastery: number;

  @Prop({ default: 'new', enum: ['new', 'learning', 'review', 'mastered'] })
  status: string;

  @Prop({ default: 2.5 })
  easeFactor: number;

  @Prop({ default: 0 })
  intervalDays: number;

  @Prop({ required: true, type: Date, index: true })
  dueAt: Date;
}

export const CardProgressSchema = SchemaFactory.createForClass(CardProgress);

// Thiết lập Chỉ mục phức hợp (Compound Index) tăng tốc độ quét lịch SRS
CardProgressSchema.index({ userId: 1, deckId: 1, dueAt: 1 });
// Đảm bảo tính toàn vẹn dữ liệu: Mỗi User ứng với 1 Card chỉ có duy nhất 1 bản ghi tiến độ
CardProgressSchema.index({ userId: 1, cardId: 1 }, { unique: true });
```

### 4.2. Tầng Data Transfer Object (`*.dto.ts`)

- Sử dụng các Decorators từ thư viện `class-validator` để kiểm tra định dạng dữ liệu đầu vào.
- Viết câu thông báo lỗi (`message`) bằng Tiếng Việt thân thiện với người dùng cuối để Frontend Next.js hiển thị trực tiếp.
- Đối với các trường không bắt buộc, luôn đi kèm `@IsOptional()`. Đối với định dạng ID của MongoDB, dùng `@IsMongoId()`.

_Ví dụ mẫu cho `create-deck.dto.ts`:_

```typescript
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
} from 'class-validator';

export class CreateDeckDto {
  @IsString({ message: 'Tiêu đề bộ bài phải là một chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tiêu đề bộ học tập không được để trống' })
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['private', 'link', 'public'], {
    message: 'Trạng thái hiển thị không hợp lệ',
  })
  @IsOptional()
  visibility?: string;

  @IsArray({ message: 'Danh sách nhãn tags phải là một mảng' })
  @IsString({ each: true, message: 'Mỗi thẻ tag phải là định dạng chữ' })
  @IsOptional()
  tags?: string[];
}
```

### 4.3. Tầng Repository (`*.repository.ts`)

- Lớp Repository là nơi duy nhất được quyền trực tiếp thao tác, truy vấn Mongoose Model thông qua `@InjectModel()`.
- **Tuyệt đối cấm** viết các logic nghiệp vụ (như so khớp mật khẩu, kiểm tra quyền sở hữu) tại đây. Chỉ chứa các hàm CRUD thuần túy hoặc Aggregation Pipeline phức tạp.

_Ví dụ mẫu cho `deck.repository.ts`:_

```typescript
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Deck, DeckDocument } from './schemas/deck.schema';
import { CreateDeckDto } from './dto/create-deck.dto';

@Injectable()
export class DeckRepository {
  constructor(
    @InjectModel(Deck.name) private readonly deckModel: Model<DeckDocument>,
  ) {}

  async create(
    createDeckDto: CreateDeckDto,
    userId: string,
  ): Promise<DeckDocument> {
    const newDeck = new this.deckModel({
      ...createDeckDto,
      createdBy: new Types.ObjectId(userId),
    });
    return newDeck.save();
  }

  async findById(id: string): Promise<DeckDocument | null> {
    return this.deckModel.findById(id).exec();
  }

  async updateCardCount(deckId: string, count: number): Promise<void> {
    await this.deckModel
      .findByIdAndUpdate(deckId, { $inc: { cardCount: count } })
      .exec();
  }
}
```

### 4.4. Tầng Service (`*.service.ts`)

- Đóng vai trò là "Trái tim" chứa toàn bộ logic, thuật toán (như tính toán chu kỳ ôn tập SRS của SuperMemo SM-2) và điều phối dòng dữ liệu.
- Được quyền Inject các Repository hoặc các Service của Module khác (thông qua cơ chế Export công khai của Module bạn).

_Ví dụ mẫu cho `deck.service.ts`:_

```typescript
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { DeckRepository } from './deck.repository';
import { CreateDeckDto } from './dto/create-deck.dto';

@Injectable()
export class DeckService {
  constructor(private readonly deckRepository: DeckRepository) {}

  async createDeck(createDeckDto: CreateDeckDto, userId: string) {
    return this.deckRepository.create(createDeckDto, userId);
  }

  async validateDeckOwner(deckId: string, userId: string) {
    const deck = await this.deckRepository.findById(deckId);
    if (!deck) {
      throw new NotFoundException('Bộ học tập này không tồn tại trên hệ thống');
    }
    if (deck.createdBy.toString() !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền chỉnh sửa bộ bài của người khác',
      );
    }
    return deck;
  }
}
```

### 4.5. Tầng Controller (`*.controller.ts`)

- Nhiệm vụ duy nhất: Định nghĩa API Endpoints, kiểm soát phân quyền đăng nhập thông qua `@UseGuards()`, lấy thông tin User từ Request, chuyển giao dữ liệu xuống Service và định hình cấu trúc dữ liệu phản hồi JSON.
- Không viết khối lệnh `try / catch` thủ công bọc quanh toàn bộ hàm, hãy để NestJS Exception Filters xử lý tự động.

_Ví dụ mẫu cho `deck.controller.ts`:_

```typescript
import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { DeckService } from './deck.service';
import { CreateDeckDto } from './dto/create-deck.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Giả định hệ thống có sẵn Jwt Guard

@Controller('v1/decks')
export class DeckController {
  constructor(private readonly deckService: DeckService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createDeckDto: CreateDeckDto, @Req() req: any) {
    const userId = req.user.id; // Lấy ID của user đang đăng nhập từ JWT Context
    const data = await this.deckService.createDeck(createDeckDto, userId);

    return {
      success: true,
      message: 'Tạo bộ học tập thành công',
      data,
    };
  }
}
```

### 4.6. Tầng Module Configuration (`*.module.ts`)

- Điểm lắp ráp dây chuyền tự động hóa DI. Khai báo các Controller sẽ chạy, các lớp Service/Repository làm `providers`, và sử dụng `MongooseModule.forFeature()` để nạp Schema tương ứng vào.

_Ví dụ mẫu cho `deck.module.ts`:_

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DeckController } from './deck.controller';
import { DeckService } from './deck.service';
import { DeckRepository } from './deck.repository';
import { Deck, DeckSchema } from './schemas/deck.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Deck.name, schema: DeckSchema }]),
  ],
  controllers: [DeckController],
  providers: [DeckService, DeckRepository],
  exports: [DeckService, DeckRepository], // Cho phép các module học tập, AI sử dụng lại
})
export class DeckModule {}
```

---

## 5. Kiến Trúc Xử Lý AI Bất Đồng Bộ (Background Jobs với BullMQ)

Do hệ thống tích hợp tính năng sinh Flashcard bằng AI từ tài liệu tải lên tốn rất nhiều thời gian tính toán, luồng đi của hệ thống bắt buộc phải áp dụng kiến trúc tách lớp bất đồng bộ như sau:

1. **Giai đoạn nhận Request:** Người dùng tải file lên $\rightarrow$ `AiGeneratorController` tiếp nhận $\rightarrow$ Tạo bản ghi Job trong database với trạng thái `queued` $\rightarrow$ Đẩy Job vào Queue của BullMQ $\rightarrow$ **Ngay lập tức trả về HTTP Status 202 (Accepted) kèm `jobId` cho Frontend Next.js hiển thị hiệu ứng Loading.**
2. **Giai đoạn xử lý ngầm (Background Worker):** Lớp `AiProcessor` lắng nghe hàng đợi BullMQ ngầm $\rightarrow$ Lấy nội dung tài liệu $\rightarrow$ Gọi API của OpenAI/Gemini phát sinh Flashcards $\rightarrow$ Parse cấu trúc mảng JSON trả về $\rightarrow$ Thực hiện **Bulk Insert (Lưu hàng loạt)** bằng phương thức `insertMany()` của Mongoose qua `CardRepository` $\rightarrow$ Đổi trạng thái Job sang `done`.
3. **Giai đoạn đồng bộ kết quả:** Frontend liên tục thực hiện cơ chế Polling (hoặc lắng nghe qua WebSockets) tới endpoint trạng thái Job. Khi thấy trạng thái chuyển thành `done`, hiển thị toàn bộ bộ thẻ học mới lên giao diện cho User học bài.

---

## 6. Checklist Nghiêm Ngặt Trước Khi Đẩy Code Lên Github (PR Checklist)

- [ ] Toàn bộ các File trong Module đã được dọn sạch, không còn file thừa dạng `*.route.ts` hay các liên kết thủ công.
- [ ] Không sử dụng từ khóa `new` cho bất cứ một Service, Repository hay Controller nào trong luồng xử lý.
- [ ] Tất cả các trường dữ liệu đầu vào trong DTO đều được bao bọc bởi Decorators validate của `class-validator` kèm thông báo lỗi Tiếng Việt.
- [ ] Cơ sở dữ liệu đã được tối ưu hóa bằng cách đặt thuộc tính `index: true` hoặc Compound Index cho các trường lọc chính (`userId`, `deckId`, `dueAt`).
- [ ] Không chứa các hàm `try/catch` thủ công trả về mã lỗi HTTP trực tiếp ở Controller, tận dụng hoàn toàn hệ thống Exception Filters của NestJS.
      """

with open("NESTJS_ARCHITECTURE_GUIDELINES.md", "w", encoding="utf-8") as file:
file.write(nestjs_guidelines_content)

print("File generated successfully.")

```
Tôi đã làm lại hoàn chỉnh file đặc tả kiến trúc mới, chuyển đổi toàn bộ bộ luật cũ (từ dạng Express giả lập) sang cấu trúc **NestJS tiêu chuẩn 100%**.

Bộ luật mới này được viết trực tiếp dựa trên cấu trúc thư mục hiện tại của nhóm bạn và bổ sung các quy tắc xử lý AI bất đồng bộ (BullMQ) cùng tối ưu hóa cơ sở dữ liệu để đảm bảo đồ án chạy cực kỳ mượt mà.

File đặc tả kiến trúc NestJS chuẩn chỉnh đã sẵn sàng để bạn tải xuống:
[file-tag: code-generated-file-0-1779411184417342961]

### Các điểm nâng cấp cốt lõi trong file mới này bao gồm:
1. **Loại bỏ hoàn toàn lớp `Route`:** Hướng dẫn cách dùng Decorators (`@Controller`, `@Post`, `@Body`,...) trực tiếp tại lớp Controller để định tuyến API theo đúng quy chuẩn NestJS.
2. **Chuẩn hóa Dependency Injection (DI):** Cấm tuyệt đối từ khóa `new`. Mọi thứ như `Repository`, `Service` đều được đăng ký qua hệ thống IoC Container và Inject qua constructor.
3. **Quy tắc đóng gói Module:** Toàn bộ Schema, DTO, Service, Controller của tính năng nào (như `decks`, `card-progress`) sẽ nằm gọn trong thư mục của module đó, không gom chung về thư mục database để tránh phá vỡ kiến trúc Module-Based của NestJS.
4. **Xử lý AI bất đồng bộ (Background Jobs):** Quy định luồng đi chi tiết khi AI sinh Flashcard để không làm nghẽn Event Loop của Node.js, sử dụng hàng đợi và trả về HTTP 202 ngay lập tức cho Frontend.
5. **Checklist trước khi PR (Pull Request):** Giúp các thành viên trong nhóm tự soát lỗi code trước khi merge vào nhánh chính.

Bạn hãy đưa file `NESTJS_ARCHITECTURE_GUIDELINES.md` này vào thư mục gốc của dự án để cả nhóm cùng đọc và code theo một chuẩn duy nhất nhé!

```
