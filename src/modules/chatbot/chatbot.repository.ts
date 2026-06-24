import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  DEFAULT_CHAT_HISTORY_LIMIT,
  DEFAULT_CONVERSATION_TITLE,
} from './constants/chatbot.constants';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { QueryConversationsDto } from './dto/query-conversations.dto';
import { QueryMessagesDto } from './dto/query-messages.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import {
  ChatConversation,
  ChatConversationDocument,
} from './schemas/chat-conversation.schema';
import {
  ChatMessage,
  ChatMessageDocument,
  ChatMessageRole,
} from './schemas/chat-message.schema';

interface CreateMessageParams {
  conversationId: string;
  userId: string;
  role: ChatMessageRole;
  content: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ChatbotRepository {
  constructor(
    @InjectModel(ChatConversation.name)
    private readonly conversationModel: Model<ChatConversationDocument>,
    @InjectModel(ChatMessage.name)
    private readonly messageModel: Model<ChatMessageDocument>,
  ) {}

  async createConversation(
    createConversationDto: CreateConversationDto,
    userId: string,
  ): Promise<ChatConversationDocument> {
    const title =
      createConversationDto.title?.trim() || DEFAULT_CONVERSATION_TITLE;

    return this.conversationModel.create({
      userId: new Types.ObjectId(userId),
      title,
      deckId: createConversationDto.deckId
        ? new Types.ObjectId(createConversationDto.deckId)
        : undefined,
      type: createConversationDto.deckId ? 'deck_chat' : 'general',
      lastMessageAt: new Date(),
    });
  }

  async findConversationById(
    conversationId: string,
    userId: string,
  ): Promise<ChatConversationDocument | null> {
    return this.conversationModel
      .findOne({
        _id: new Types.ObjectId(conversationId),
        userId: new Types.ObjectId(userId),
        deletedAt: { $exists: false },
      })
      .exec();
  }

  async findConversations(
    userId: string,
    query: QueryConversationsDto,
  ): Promise<[ChatConversationDocument[], number]> {
    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
      deletedAt: { $exists: false },
    };

    if (!query.includeArchived) {
      filter.isArchived = false;
    }

    return Promise.all([
      this.conversationModel
        .find(filter)
        .sort({ lastMessageAt: -1 })
        .skip(query.skip)
        .limit(query.limit)
        .exec(),
      this.conversationModel.countDocuments(filter).exec(),
    ]);
  }

  async updateConversation(
    conversationId: string,
    userId: string,
    updateConversationDto: UpdateConversationDto,
  ): Promise<ChatConversationDocument | null> {
    const update: Record<string, unknown> = {};

    if (typeof updateConversationDto.title === 'string') {
      update.title = updateConversationDto.title.trim();
    }

    if (typeof updateConversationDto.isArchived === 'boolean') {
      update.isArchived = updateConversationDto.isArchived;
    }

    return this.conversationModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(conversationId),
          userId: new Types.ObjectId(userId),
          deletedAt: { $exists: false },
        },
        { $set: update },
        { new: true },
      )
      .exec();
  }

  async softDeleteConversation(
    conversationId: string,
    userId: string,
  ): Promise<ChatConversationDocument | null> {
    return this.conversationModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(conversationId),
          userId: new Types.ObjectId(userId),
          deletedAt: { $exists: false },
        },
        {
          $set: {
            deletedAt: new Date(),
            isArchived: true,
          },
        },
        { new: true },
      )
      .exec();
  }

  async createMessage(
    params: CreateMessageParams,
  ): Promise<ChatMessageDocument> {
    const now = new Date();
    const message = await this.messageModel.create({
      conversationId: new Types.ObjectId(params.conversationId),
      userId: new Types.ObjectId(params.userId),
      role: params.role,
      content: params.content,
      metadata: params.metadata ?? {},
    });

    await this.conversationModel
      .findByIdAndUpdate(params.conversationId, {
        $set: { lastMessageAt: now },
        $inc: { messageCount: 1 },
      })
      .exec();

    return message;
  }

  async findMessages(
    conversationId: string,
    userId: string,
    query: QueryMessagesDto,
  ): Promise<[ChatMessageDocument[], number]> {
    const filter = {
      conversationId: new Types.ObjectId(conversationId),
      userId: new Types.ObjectId(userId),
    };

    const [messages, count] = await Promise.all([
      this.messageModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(query.skip)
        .limit(query.limit)
        .exec(),
      this.messageModel.countDocuments(filter).exec(),
    ]);

    return [messages.reverse(), count];
  }

  async findRecentMessages(
    conversationId: string,
    limit = DEFAULT_CHAT_HISTORY_LIMIT,
  ): Promise<ChatMessageDocument[]> {
    const messages = await this.messageModel
      .find({ conversationId: new Types.ObjectId(conversationId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    return messages.reverse();
  }
}
