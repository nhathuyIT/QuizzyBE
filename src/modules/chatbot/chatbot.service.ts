import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { DocumentService } from '../academic/services/document.service';
import { AiGeneratorRepository } from '../ai-generator/ai-generator.repository';
import { AiGeneratorService } from '../ai-generator/ai-generator.service';
import { CardRepository } from '../card/card.repository';
import { CardDocument } from '../card/schemas/card.schema';
import { DeckService } from '../deck/deck.service';
import {
  DEFAULT_CARD_CONTEXT_LIMIT,
  DEFAULT_CHAT_HISTORY_LIMIT,
  DEFAULT_CONVERSATION_TITLE,
  DEFAULT_MAX_INPUT_CHARS,
  FLASHCARD_GENERATE_JOB,
  FLASHCARD_GENERATE_QUEUE,
} from './constants/chatbot.constants';
import {
  BASE_CHAT_SYSTEM_PROMPT,
  buildAcademicDocumentContextPrompt,
  buildDeckContextPrompt,
} from './constants/prompts';
import { ChatbotRepository } from './chatbot.repository';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { GenerateFlashcardsAcademicDocumentDto } from './dto/generate-flashcards-academic-document.dto';
import { GenerateFlashcardsPdfDto } from './dto/generate-flashcards-pdf.dto';
import { GenerateFlashcardsTextDto } from './dto/generate-flashcards-text.dto';
import { QueryConversationsDto } from './dto/query-conversations.dto';
import { QueryMessagesDto } from './dto/query-messages.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { AI_PROVIDER } from './interfaces/ai-provider.interface';
import type {
  AiChatMessage,
  FlashcardDifficulty,
  IAiProvider,
} from './interfaces/ai-provider.interface';
import {
  FlashcardGenerateJobData,
  FlashcardGenerateSourceType,
} from './interfaces/flashcard-generate-job-data.interface';
import { ChatConversationDocument } from './schemas/chat-conversation.schema';
import { ChatMessageDocument } from './schemas/chat-message.schema';
import { AcademicDocumentStorageService } from './services/academic-document-storage.service';
import { PdfParserService } from './services/pdf-parser.service';

const MAX_ACADEMIC_DOCUMENT_FILE_SIZE = 10 * 1024 * 1024;
const DEFAULT_ACTIVE_JOB_TTL_MS = 30 * 60 * 1000;

export interface UploadedPdfFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    private readonly chatbotRepository: ChatbotRepository,
    private readonly deckService: DeckService,
    private readonly cardRepository: CardRepository,
    private readonly aiGeneratorService: AiGeneratorService,
    private readonly aiGeneratorRepository: AiGeneratorRepository,
    private readonly pdfParserService: PdfParserService,
    private readonly documentService: DocumentService,
    private readonly academicDocumentStorageService: AcademicDocumentStorageService,
    private readonly configService: ConfigService,
    @InjectQueue(FLASHCARD_GENERATE_QUEUE)
    private readonly generateQueue: Queue<FlashcardGenerateJobData>,
    @Inject(AI_PROVIDER)
    private readonly aiProvider: IAiProvider,
  ) {}

  async createConversation(
    createConversationDto: CreateConversationDto,
    userId: string,
  ) {
    if (createConversationDto.deckId && createConversationDto.academicDocumentId) {
      throw new BadRequestException(
        'Choose either deckId or academicDocumentId for a conversation',
      );
    }

    if (createConversationDto.deckId) {
      await this.deckService.validateDeckOwner(
        createConversationDto.deckId,
        userId,
      );
    }

    if (createConversationDto.academicDocumentId) {
      await this.getAcademicDocumentForChat(
        createConversationDto.academicDocumentId,
      );
    }

    const conversation = await this.chatbotRepository.createConversation(
      createConversationDto,
      userId,
    );

    return this.toConversationResponse(conversation);
  }

  async getConversations(query: QueryConversationsDto, userId: string) {
    const [conversations, itemCount] =
      await this.chatbotRepository.findConversations(userId, query);

    return this.toPaginatedResponse(
      conversations.map((conversation) =>
        this.toConversationResponse(conversation),
      ),
      query.page,
      query.limit,
      itemCount,
    );
  }

  async getConversation(
    conversationId: string,
    query: QueryMessagesDto,
    userId: string,
  ) {
    const conversation = await this.getOwnedConversation(
      conversationId,
      userId,
    );
    const [messages, itemCount] = await this.chatbotRepository.findMessages(
      conversationId,
      userId,
      query,
    );

    return {
      conversation: this.toConversationResponse(conversation),
      messages: this.toPaginatedResponse(
        messages.map((message) => this.toMessageResponse(message)),
        query.page,
        query.limit,
        itemCount,
      ),
    };
  }

  async updateConversation(
    conversationId: string,
    updateConversationDto: UpdateConversationDto,
    userId: string,
  ) {
    const conversation = await this.chatbotRepository.updateConversation(
      conversationId,
      userId,
      updateConversationDto,
    );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.toConversationResponse(conversation);
  }

  async deleteConversation(conversationId: string, userId: string) {
    const conversation = await this.chatbotRepository.softDeleteConversation(
      conversationId,
      userId,
    );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return { deleted: true };
  }

  async getMessages(
    conversationId: string,
    query: QueryMessagesDto,
    userId: string,
  ) {
    await this.getOwnedConversation(conversationId, userId);
    const [messages, itemCount] = await this.chatbotRepository.findMessages(
      conversationId,
      userId,
      query,
    );

    return this.toPaginatedResponse(
      messages.map((message) => this.toMessageResponse(message)),
      query.page,
      query.limit,
      itemCount,
    );
  }

  async sendMessage(
    conversationId: string,
    sendMessageDto: SendMessageDto,
    userId: string,
  ) {
    const conversation = await this.getOwnedConversation(
      conversationId,
      userId,
    );
    const content = this.cleanUserContent(sendMessageDto.content);
    const history = await this.getAiHistory(conversationId);

    const userMessage = await this.chatbotRepository.createMessage({
      conversationId,
      userId,
      role: 'user',
      content,
    });

    const systemPrompt = await this.buildSystemPrompt(conversation, userId);
    const aiResponse = await this.safeAiChat(systemPrompt, history, content);
    const assistantMessage = await this.chatbotRepository.createMessage({
      conversationId,
      userId,
      role: 'assistant',
      content: this.cleanAiContent(aiResponse.content),
      metadata: {
        inputTokens: aiResponse.inputTokens,
        outputTokens: aiResponse.outputTokens,
      },
    });

    await this.maybeGenerateConversationTitle(conversation, content, userId);

    return {
      userMessage: this.toMessageResponse(userMessage),
      assistantMessage: this.toMessageResponse(assistantMessage),
    };
  }

  async generateFlashcardsFromText(
    generateDto: GenerateFlashcardsTextDto,
    userId: string,
  ) {
    const content = this.truncateInput(generateDto.rawText.trim());

    if (content.length < 5) {
      throw new BadRequestException('Raw text must contain at least 5 chars');
    }

    return this.queueFlashcardGeneration(
      {
        type: 'text',
        title: generateDto.title,
        content,
        cardCount: generateDto.cardCount,
        difficulty: generateDto.difficulty,
        language: generateDto.language,
        conversationId: generateDto.conversationId,
      },
      userId,
    );
  }

  async generateFlashcardsFromPdf(
    generateDto: GenerateFlashcardsPdfDto,
    file: UploadedPdfFile | undefined,
    userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('PDF file is required');
    }

    if (
      file.mimetype !== 'application/pdf' &&
      !file.originalname.toLowerCase().endsWith('.pdf')
    ) {
      throw new BadRequestException('Only PDF files are supported');
    }

    const content = this.truncateInput(
      await this.pdfParserService.extractText(file.buffer),
    );

    return this.queueFlashcardGeneration(
      {
        type: 'pdf',
        title: generateDto.title,
        content,
        fileUrl: file.originalname,
        cardCount: generateDto.cardCount,
        difficulty: generateDto.difficulty,
        language: generateDto.language,
        conversationId: generateDto.conversationId,
      },
      userId,
    );
  }

  async generateFlashcardsFromAcademicDocument(
    generateDto: GenerateFlashcardsAcademicDocumentDto,
    userId: string,
  ) {
    const { document, subject } =
      await this.documentService.findActiveDocumentForGeneration(
        generateDto.documentId,
      );

    if (document.fileType !== 'pdf') {
      throw new BadRequestException(
        'Only PDF academic documents are supported right now',
      );
    }

    if (document.fileSize > MAX_ACADEMIC_DOCUMENT_FILE_SIZE) {
      throw new BadRequestException('Academic document file is too large');
    }

    const fileBuffer = await this.academicDocumentStorageService.download(
      document.storagePath,
      document.fileUrl,
    );
    const content = this.truncateInput(
      await this.extractAcademicPdfText(fileBuffer),
    );
    const title = generateDto.title?.trim() || document.title;
    const sourceTitle = document.title.trim();

    return this.queueFlashcardGeneration(
      {
        type: 'academic_document',
        title,
        content,
        fileUrl: document.fileUrl,
        storagePath: document.storagePath,
        fileType: document.fileType,
        academicDocumentId: document._id.toString(),
        subjectId: document.subjectId.toString(),
        deckDescription: `Generated from academic document: ${sourceTitle}`,
        deckTags: [
          'ai-generated',
          'academic',
          document.fileType,
          subject.code,
        ].filter(Boolean),
        cardCount: generateDto.cardCount,
        difficulty: generateDto.difficulty,
        language: generateDto.language,
        conversationId: generateDto.conversationId,
      },
      userId,
    );
  }

  async getJobStatus(jobId: string, userId: string) {
    const job = await this.aiGeneratorService.findJobById(jobId);

    if (job.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You do not have permission to view this job',
      );
    }

    return {
      _id: job._id.toString(),
      sourceId: job.sourceId.toString(),
      sourceType: job.sourceType,
      academicDocumentId: job.academicDocumentId?.toString(),
      targetDeckId: job.targetDeckId?.toString(),
      status: job.status,
      options: job.options,
      usage: job.usage,
      errorMessage: job.errorMessage,
      finishedAt: job.finishedAt,
    };
  }

  private async queueFlashcardGeneration(
    params: {
      type: FlashcardGenerateSourceType;
      title: string;
      content: string;
      fileUrl?: string;
      storagePath?: string;
      fileType?: string;
      academicDocumentId?: string;
      subjectId?: string;
      deckDescription?: string;
      deckTags?: string[];
      cardCount?: number;
      difficulty?: FlashcardDifficulty;
      language?: string;
      conversationId?: string;
    },
    userId: string,
  ) {
    if (params.conversationId) {
      await this.getOwnedConversation(params.conversationId, userId);
    }

    await this.expireStaleActiveJobs(userId);

    const activeJobs =
      await this.aiGeneratorRepository.countJobsByUserAndStatuses(userId, [
        'queued',
        'running',
      ]);

    if (activeJobs >= 3) {
      throw new BadRequestException('You already have 3 active AI jobs');
    }

    const options = {
      cardCount: params.cardCount ?? 10,
      difficulty: params.difficulty ?? 'medium',
      language: params.language ?? 'vi',
    };
    const prompt = `Generate ${options.cardCount} ${options.difficulty} flashcards in ${options.language}`;
    const { source, job } =
      await this.aiGeneratorService.createSourceAndQueuedJob(
        {
          type: params.type,
          title: params.title,
          rawText: params.content,
          fileUrl: params.fileUrl,
          storagePath: params.storagePath,
          fileType: params.fileType,
          extractedText:
            params.type === 'academic_document' ? params.content : undefined,
          academicDocumentId: params.academicDocumentId,
          subjectId: params.subjectId,
          cardCount: options.cardCount,
          difficulty: options.difficulty,
          language: options.language,
        },
        userId,
        prompt,
      );

    let bullJobId: string | undefined;

    try {
      const bullJob = await this.generateQueue.add(
        FLASHCARD_GENERATE_JOB,
        {
          jobId: job._id.toString(),
          sourceId: source._id.toString(),
          userId,
          title: params.title,
          content: params.content,
          sourceType: params.type,
          academicDocumentId: params.academicDocumentId,
          subjectId: params.subjectId,
          deckDescription: params.deckDescription,
          deckTags: params.deckTags,
          options,
          conversationId: params.conversationId,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { age: 86400, count: 1000 },
          removeOnFail: { age: 604800 },
        },
      );

      bullJobId = bullJob.id;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown queue error';

      this.logger.error(`Could not queue flashcard generation: ${errorMessage}`);
      await this.aiGeneratorRepository.updateJobStatus(
        job._id.toString(),
        'failed',
        'Could not start flashcard generation',
      );

      throw new ServiceUnavailableException(
        'Could not start flashcard generation',
      );
    }

    if (params.conversationId) {
      await this.chatbotRepository.createMessage({
        conversationId: params.conversationId,
        userId,
        role: 'assistant',
        content: `Queued AI flashcard generation for "${params.title}".`,
        metadata: {
          aiJobId: job._id.toString(),
          sourceId: source._id.toString(),
          bullJobId,
          status: 'queued',
        },
      });
    }

    return {
      jobId: job._id.toString(),
      sourceId: source._id.toString(),
      bullJobId,
      status: job.status,
    };
  }

  private async expireStaleActiveJobs(userId: string) {
    const ttlMs = this.getPositiveIntConfig(
      'AI_GENERATION_ACTIVE_JOB_TTL_MS',
      DEFAULT_ACTIVE_JOB_TTL_MS,
    );
    const staleBefore = new Date(Date.now() - ttlMs);
    const expiredCount =
      await this.aiGeneratorRepository.markStaleActiveJobsFailed(
        userId,
        staleBefore,
        'AI generation job expired before completion. Please try again.',
      );

    if (expiredCount > 0) {
      this.logger.warn(
        `Expired ${expiredCount} stale AI generation job(s) for user ${userId}`,
      );
    }
  }

  private async extractAcademicPdfText(fileBuffer: Buffer): Promise<string> {
    try {
      return await this.pdfParserService.extractText(fileBuffer);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new BadRequestException(
          'Could not extract readable text from this document',
        );
      }

      throw error;
    }
  }

  private async getOwnedConversation(
    conversationId: string,
    userId: string,
  ): Promise<ChatConversationDocument> {
    const conversation = await this.chatbotRepository.findConversationById(
      conversationId,
      userId,
    );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  private async getAiHistory(conversationId: string): Promise<AiChatMessage[]> {
    const historyLimit = this.getPositiveIntConfig(
      'CHATBOT_MAX_HISTORY',
      DEFAULT_CHAT_HISTORY_LIMIT,
    );
    const messages = await this.chatbotRepository.findRecentMessages(
      conversationId,
      historyLimit,
    );

    return messages
      .filter(
        (message) => message.role === 'user' || message.role === 'assistant',
      )
      .map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        content: message.content,
      }));
  }

  private async buildSystemPrompt(
    conversation: ChatConversationDocument,
    userId: string,
  ): Promise<string> {
    const deckId = conversation.deckId?.toString();
    const academicDocumentId = conversation.academicDocumentId?.toString();

    if (academicDocumentId) {
      const documentContext =
        await this.buildAcademicDocumentPromptContext(academicDocumentId);

      return [BASE_CHAT_SYSTEM_PROMPT, documentContext]
        .filter(Boolean)
        .join('\n\n');
    }

    if (!deckId) {
      return BASE_CHAT_SYSTEM_PROMPT;
    }

    await this.deckService.validateDeckOwner(deckId, userId);
    const contextLimit = this.getPositiveIntConfig(
      'CHATBOT_MAX_CARD_CONTEXT',
      DEFAULT_CARD_CONTEXT_LIMIT,
    );
    const cards = await this.cardRepository.findByDeckId(deckId);
    const deckContext = this.formatCardsForPrompt(cards.slice(0, contextLimit));

    return [BASE_CHAT_SYSTEM_PROMPT, buildDeckContextPrompt(deckContext)]
      .filter(Boolean)
      .join('\n\n');
  }

  private formatCardsForPrompt(cards: CardDocument[]): string {
    return cards
      .map((card, index) => `${index + 1}. ${card.front} -> ${card.back}`)
      .join('\n');
  }

  private async buildAcademicDocumentPromptContext(
    academicDocumentId: string,
  ): Promise<string> {
    const { document, subject } =
      await this.getAcademicDocumentForChat(academicDocumentId);
    const fileBuffer = await this.academicDocumentStorageService.download(
      document.storagePath,
      document.fileUrl,
    );
    const maxContextChars = this.getPositiveIntConfig(
      'CHATBOT_MAX_DOCUMENT_CONTEXT_CHARS',
      DEFAULT_MAX_INPUT_CHARS,
    );
    const content = (await this.extractAcademicPdfText(fileBuffer)).slice(
      0,
      maxContextChars,
    );

    return buildAcademicDocumentContextPrompt({
      documentTitle: document.title,
      subjectCode: subject.code,
      content,
    });
  }

  private async getAcademicDocumentForChat(academicDocumentId: string) {
    const result = await this.documentService.findActiveDocumentForGeneration(
      academicDocumentId,
    );

    if (result.document.fileType !== 'pdf') {
      throw new BadRequestException(
        'Only PDF academic documents are supported right now',
      );
    }

    if (result.document.fileSize > MAX_ACADEMIC_DOCUMENT_FILE_SIZE) {
      throw new BadRequestException('Academic document file is too large');
    }

    return result;
  }

  private getPositiveIntConfig(key: string, fallback: number): number {
    const value = Number(this.configService.get<string | number>(key));

    if (!Number.isInteger(value) || value < 1) {
      return fallback;
    }

    return value;
  }

  private async safeAiChat(
    systemPrompt: string,
    history: AiChatMessage[],
    message: string,
  ) {
    try {
      return await this.aiProvider.chat(systemPrompt, history, message);
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : 'Unknown AI provider error';

      if (messageText.includes('RATE_LIMIT') || messageText.includes('429')) {
        throw new ServiceUnavailableException(
          'AI service is busy. Please try again later',
        );
      }

      if (messageText.includes('Gemini API is not configured')) {
        throw new InternalServerErrorException('AI provider is not configured');
      }

      this.logger.error(messageText);
      throw new InternalServerErrorException('Could not process AI response');
    }
  }

  private async maybeGenerateConversationTitle(
    conversation: ChatConversationDocument,
    firstMessage: string,
    userId: string,
  ) {
    if (
      conversation.title !== DEFAULT_CONVERSATION_TITLE ||
      conversation.messageCount > 0
    ) {
      return;
    }

    try {
      const title = await this.aiProvider.generateTitle(firstMessage);
      await this.chatbotRepository.updateConversation(
        conversation._id.toString(),
        userId,
        { title },
      );
    } catch {
      const fallbackTitle = firstMessage.slice(0, 60).trim();
      await this.chatbotRepository.updateConversation(
        conversation._id.toString(),
        userId,
        { title: fallbackTitle || DEFAULT_CONVERSATION_TITLE },
      );
    }
  }

  private cleanUserContent(content: string): string {
    const cleaned = content.trim();

    if (!cleaned) {
      throw new BadRequestException('Message content is required');
    }

    return cleaned;
  }

  private cleanAiContent(content: string): string {
    return content.replace(/<[^>]*>/g, '').trim();
  }

  private truncateInput(content: string): string {
    const maxChars =
      this.configService.get<number>('CHATBOT_MAX_INPUT_CHARS') ??
      DEFAULT_MAX_INPUT_CHARS;

    return content.slice(0, maxChars);
  }

  private toPaginatedResponse<T>(
    data: T[],
    page: number,
    limit: number,
    itemCount: number,
  ) {
    const pageCount = Math.ceil(itemCount / limit);

    return {
      data,
      meta: {
        page,
        limit,
        itemCount,
        pageCount,
        hasPreviousPage: page > 1,
        hasNextPage: page < pageCount,
      },
    };
  }

  private toConversationResponse(conversation: ChatConversationDocument) {
    const plain = conversation.toObject() as Record<string, unknown>;

    return {
      ...plain,
      _id: conversation._id.toString(),
      userId: conversation.userId.toString(),
      deckId: conversation.deckId?.toString(),
      academicDocumentId: conversation.academicDocumentId?.toString(),
    };
  }

  private toMessageResponse(message: ChatMessageDocument) {
    const plain = message.toObject() as Record<string, unknown>;

    return {
      ...plain,
      _id: message._id.toString(),
      conversationId: message.conversationId.toString(),
      userId: message.userId.toString(),
    };
  }
}
