import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type StudySessionDocument = StudySessionEntity & Document;

@Schema({ _id: false })
export class StudySessionStats {
  @Prop({ default: 0 })
  correct!: number;

  @Prop({ default: 0 })
  wrong!: number;

  @Prop({ default: 0 })
  skipped!: number;

  @Prop({ default: 0 })
  timeSpentSec!: number;
}

export const StudySessionStatsSchema =
  SchemaFactory.createForClass(StudySessionStats);

@Schema({ collection: 'study_sessions', timestamps: true })
export class StudySessionEntity {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Deck',
    required: true,
    index: true,
  })
  deckId!: Types.ObjectId;

  @Prop({
    enum: ['flashcard', 'learn', 'test', 'match'],
    default: 'flashcard',
    required: true,
  })
  mode!: 'flashcard' | 'learn' | 'test' | 'match';

  @Prop({ default: Date.now })
  startedAt!: Date;

  @Prop()
  finishedAt?: Date;

  @Prop({ type: StudySessionStatsSchema, default: () => ({}) })
  stats!: StudySessionStats;
}

export const StudySessionSchema =
  SchemaFactory.createForClass(StudySessionEntity);
