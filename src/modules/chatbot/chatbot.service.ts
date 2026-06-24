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
  buildDeckContextPrompt,
} from './constants/prompts';
import { ChatbotRepository } from './chatbot.repository';
import { CreateConversationDto } from './dto/create-conversation.dto';
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
import { FlashcardGenerateJobData } from './interfaces/flashcard-generate-job-data.interface';
import { ChatConversationDocument } from './schemas/chat-conversation.schema';
import { ChatMessageDocument } from './schemas/chat-message.schema';
import { PdfParserService } from './services/pdf-parser.service';

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
    if (createConversationDto.deckId) {
      await this.deckService.validateDeckOwner(
        createConversationDto.deckId,
        userId,
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
      type: 'text' | 'pdf';
      title: string;
      content: string;
      fileUrl?: string;
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
          cardCount: options.cardCount,
          difficulty: options.difficulty,
          language: options.language,
        },
        userId,
        prompt,
      );

    const bullJob = await this.generateQueue.add(
      FLASHCARD_GENERATE_JOB,
      {
        jobId: job._id.toString(),
        sourceId: source._id.toString(),
        userId,
        title: params.title,
        content: params.content,
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

    if (params.conversationId) {
      await this.chatbotRepository.createMessage({
        conversationId: params.conversationId,
        userId,
        role: 'assistant',
        content: `Queued AI flashcard generation for "${params.title}".`,
        metadata: {
          aiJobId: job._id.toString(),
          sourceId: source._id.toString(),
          bullJobId: bullJob.id,
          status: 'queued',
        },
      });
    }

    return {
      jobId: job._id.toString(),
      sourceId: source._id.toString(),
      bullJobId: bullJob.id,
      status: job.status,
    };
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
    const historyLimit =
      this.configService.get<number>('CHATBOT_MAX_HISTORY') ??
      DEFAULT_CHAT_HISTORY_LIMIT;
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

    if (!deckId) {
      return BASE_CHAT_SYSTEM_PROMPT;
    }

    await this.deckService.validateDeckOwner(deckId, userId);
    const contextLimit =
      this.configService.get<number>('CHATBOT_MAX_CARD_CONTEXT') ??
      DEFAULT_CARD_CONTEXT_LIMIT;
    const cards = await this.cardRepository.findByDeckId(deckId);
    const deckContext = this.formatCardsForPrompt(cards.slice(0, contextLimit));

    return [BASE_CHAT_SYSTEM_PROMPT, buildDeckContextPrompt(deckContext)]
      .filter(Boolean)
      .join('\n\n');
  }

  private formatCardsForPrompt(cards: CardDocument[]): string {
    return cards
      .map((card, index) => {
        const parts = [
          `${index + 1}. Front: ${card.front}`,
          `Back: ${card.back}`,
        ];

        if (card.hint) {
          parts.push(`Hint: ${card.hint}`);
        }

        if (card.explanation) {
          parts.push(`Explanation: ${card.explanation}`);
        }

        return parts.join(' | ');
      })
      .join('\n');
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
