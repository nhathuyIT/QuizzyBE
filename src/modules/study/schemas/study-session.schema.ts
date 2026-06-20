import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type StudySessionDocument = StudySession & Document;

@Schema({ _id: false })
class SessionStats {
  @Prop({ default: 0 })
  correct!: number;

  @Prop({ default: 0 })
  wrong!: number;

  @Prop({ default: 0 })
  skipped!: number;

  @Prop({ default: 0 })
  timeSpentSec!: number;
}

@Schema({
  collection: 'study_sessions',
  timestamps: true,
})
export class StudySession {
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

  @Prop({ required: true, enum: ['flashcard', 'learn', 'test', 'match'] })
  mode!: 'flashcard' | 'learn' | 'test' | 'match';

  @Prop({ default: Date.now })
  startedAt!: Date;

  @Prop({ type: Date })
  finishedAt?: Date;

  @Prop({
    type: SessionStats,
    default: () => ({ correct: 0, wrong: 0, skipped: 0, timeSpentSec: 0 }),
  })
  stats!: SessionStats;
}

export const StudySessionSchema = SchemaFactory.createForClass(StudySession);

StudySessionSchema.index({ startedAt: -1, mode: 1, finishedAt: 1 });
StudySessionSchema.index({ userId: 1, startedAt: -1 });
