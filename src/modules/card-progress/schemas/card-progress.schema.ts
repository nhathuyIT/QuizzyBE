import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type CardProgressDocument = CardProgress & Document;

@Schema({
  collection: 'card_progress',
  timestamps: true,
})
export class CardProgress {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Card',
    required: true,
    index: true,
  })
  cardId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Deck',
    required: true,
    index: true,
  })
  deckId: Types.ObjectId;

  @Prop({ default: 0, min: 0, max: 100 })
  mastery: number;

  @Prop({ default: 'new', enum: ['new', 'learning', 'review', 'mastered'] })
  status: string;

  @Prop({ default: 2.5 })
  easeFactor: number;

  @Prop({ default: 0 })
  intervalDays: number;

  @Prop({ required: true, type: Date, index: true })
  dueAt: Date;

  @Prop({ default: 0 })
  correctCount: number;

  @Prop({ default: 0 })
  wrongCount: number;
}

export const CardProgressSchema = SchemaFactory.createForClass(CardProgress);

CardProgressSchema.index({ userId: 1, cardId: 1 }, { unique: true });
CardProgressSchema.index({ userId: 1, deckId: 1, dueAt: 1 });
