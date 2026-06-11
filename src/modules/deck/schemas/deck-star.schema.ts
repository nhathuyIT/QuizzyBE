import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type DeckStarDocument = DeckStar & Document;

@Schema({
  collection: 'deck_stars',
  timestamps: { createdAt: true, updatedAt: false },
})
export class DeckStar {
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
}

export const DeckStarSchema = SchemaFactory.createForClass(DeckStar);

DeckStarSchema.index({ userId: 1, deckId: 1 }, { unique: true });
