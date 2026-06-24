import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ChatMessageDocument = ChatMessage & Document;

export type ChatMessageRole = 'user' | 'assistant' | 'system';

@Schema({
  collection: 'chat_messages',
  timestamps: { createdAt: true, updatedAt: false },
})
export class ChatMessage {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'ChatConversation',
    required: true,
    index: true,
  })
  conversationId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({ required: true, enum: ['user', 'assistant', 'system'] })
  role!: ChatMessageRole;

  @Prop({ required: true })
  content!: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  metadata!: Record<string, unknown>;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);

ChatMessageSchema.index({ conversationId: 1, createdAt: -1 });
ChatMessageSchema.index({ userId: 1, createdAt: -1 });
