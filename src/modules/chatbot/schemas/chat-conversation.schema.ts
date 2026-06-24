import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ChatConversationDocument = ChatConversation & Document;

export type ChatConversationType = 'general' | 'deck_chat';

@Schema({ collection: 'chat_conversations', timestamps: true })
export class ChatConversation {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 200 })
  title!: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Deck',
    index: true,
  })
  deckId?: Types.ObjectId;

  @Prop({ default: 'general', enum: ['general', 'deck_chat'] })
  type!: ChatConversationType;

  @Prop({ default: false, index: true })
  isArchived!: boolean;

  @Prop({ default: 0 })
  messageCount!: number;

  @Prop({ type: Date, default: Date.now, index: true })
  lastMessageAt!: Date;

  @Prop({ type: Date, index: true })
  deletedAt?: Date;
}

export const ChatConversationSchema =
  SchemaFactory.createForClass(ChatConversation);

ChatConversationSchema.index({ userId: 1, deletedAt: 1, lastMessageAt: -1 });
ChatConversationSchema.index({ userId: 1, isArchived: 1, lastMessageAt: -1 });
