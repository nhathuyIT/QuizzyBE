import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type CardReviewDocument = CardReview & Document;

@Schema({
  collection: 'card_reviews',
  timestamps: { createdAt: true, updatedAt: false },
})
export class CardReview {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'StudySession',
    required: true,
    index: true,
  })
  sessionId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Card', required: true })
  cardId!: Types.ObjectId;

  @Prop()
  answer?: string;

  @Prop({ required: true })
  isCorrect!: boolean;

  @Prop({ required: true, enum: ['again', 'hard', 'good', 'easy'] })
  rating!: string;

  @Prop({ required: true })
  responseTimeMs!: number;
}

export const CardReviewSchema = SchemaFactory.createForClass(CardReview);
