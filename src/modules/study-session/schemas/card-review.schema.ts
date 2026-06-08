import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type CardReviewDocument = CardReviewEntity & Document;

@Schema({
  collection: 'card_reviews',
  timestamps: { createdAt: true, updatedAt: false },
})
export class CardReviewEntity {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'StudySessionEntity',
    required: true,
    index: true,
  })
  sessionId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Card',
    required: true,
    index: true,
  })
  cardId!: Types.ObjectId;

  @Prop()
  answer?: string;

  @Prop({ required: true })
  isCorrect!: boolean;

  @Prop({ enum: ['again', 'hard', 'good', 'easy'], required: true })
  rating!: 'again' | 'hard' | 'good' | 'easy';

  @Prop({ min: 0, required: true })
  responseTimeMs!: number;
}

export const CardReviewSchema = SchemaFactory.createForClass(CardReviewEntity);
