import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type AiSourceDocument = AiSource & Document;

@Schema({ collection: 'ai_sources', timestamps: true })
export class AiSource {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: ['text', 'pdf', 'url', 'image'] })
  type: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  rawText?: string;

  @Prop()
  fileUrl?: string;

  @Prop()
  extractedText?: string;

  @Prop({ default: 'uploaded', enum: ['uploaded', 'parsed', 'failed'] })
  status: string;
}

export const AiSourceSchema = SchemaFactory.createForClass(AiSource);
