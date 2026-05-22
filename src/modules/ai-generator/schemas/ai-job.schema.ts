import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type AiGenerationJobDocument = AiGenerationJob & Document;

@Schema({ _id: false })
class JobOptions {
  @Prop({ default: 10 })
  cardCount!: number;

  @Prop({ default: 'medium', enum: ['easy', 'medium', 'hard'] })
  difficulty!: string;

  @Prop({ default: 'vi' })
  language!: string;
}

@Schema({ collection: 'ai_generation_jobs', timestamps: true })
export class AiGenerationJob {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'AiSource',
    required: true,
  })
  sourceId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Deck' })
  targetDeckId?: Types.ObjectId;

  @Prop({ default: 'queued', enum: ['queued', 'running', 'done', 'failed'] })
  status!: string;

  @Prop({ required: true })
  prompt!: string;

  @Prop({
    type: JobOptions,
    default: () => ({ cardCount: 10, difficulty: 'medium', language: 'vi' }),
  })
  options!: JobOptions;

  @Prop({ type: MongooseSchema.Types.Mixed })
  usage?: { inputTokens: number; outputTokens: number };

  @Prop()
  errorMessage?: string;

  @Prop({ type: Date })
  finishedAt?: Date;
}

export const AiGenerationJobSchema =
  SchemaFactory.createForClass(AiGenerationJob);
