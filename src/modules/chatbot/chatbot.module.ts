import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { AcademicModule } from '../academic/academic.module';
import { AiGeneratorModule } from '../ai-generator/ai-generator.module';
import { DeckModule } from '../deck/deck.module';
import { FLASHCARD_GENERATE_QUEUE } from './constants/chatbot.constants';
import { ChatbotController, ChatbotHelpController } from './chatbot.controller';
import { ChatbotRepository } from './chatbot.repository';
import { ChatbotService } from './chatbot.service';
import { AI_PROVIDER } from './interfaces/ai-provider.interface';
import { FlashcardGenerateProcessor } from './processors/flashcard-generate.processor';
import { GeminiProvider } from './providers/gemini.provider';
import {
  ChatConversation,
  ChatConversationSchema,
} from './schemas/chat-conversation.schema';
import { ChatMessage, ChatMessageSchema } from './schemas/chat-message.schema';
import { AcademicDocumentStorageService } from './services/academic-document-storage.service';
import { FlashcardGenerationRunnerService } from './services/flashcard-generation-runner.service';
import { PdfParserService } from './services/pdf-parser.service';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: ChatConversation.name, schema: ChatConversationSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
    ]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL')?.trim();

        return {
          connection: redisUrl
            ? { url: redisUrl }
            : {
                host:
                  configService.get<string>('REDIS_HOST')?.trim() ||
                  'localhost',
                port: Number(configService.get<string>('REDIS_PORT') ?? 6379),
                password:
                  configService.get<string>('REDIS_PASSWORD')?.trim() ||
                  undefined,
              },
        };
      },
    }),
    BullModule.registerQueue({
      name: FLASHCARD_GENERATE_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800 },
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'chat', ttl: 60000, limit: 15 },
        { name: 'generate', ttl: 3600000, limit: 5 },
      ],
    }),
    AiGeneratorModule,
    AcademicModule,
    DeckModule,
  ],
  controllers: [ChatbotHelpController, ChatbotController],
  providers: [
    ChatbotService,
    ChatbotRepository,
    AcademicDocumentStorageService,
    FlashcardGenerationRunnerService,
    PdfParserService,
    FlashcardGenerateProcessor,
    GeminiProvider,
    {
      provide: AI_PROVIDER,
      useExisting: GeminiProvider,
    },
  ],
})
export class ChatbotModule {}
