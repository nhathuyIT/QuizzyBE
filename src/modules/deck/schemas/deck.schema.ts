import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type DeckDocument = Deck & Document;

@Schema({ collection: 'decks', timestamps: true })
export class Deck {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ default: 'private', enum: ['private', 'link', 'public'] })
  visibility: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  createdBy: Types.ObjectId;

  @Prop({ required: true, default: 'manual', enum: ['manual', 'ai'] })
  sourceType: string;

  @Prop({ type: [String], default: [], index: true })
  tags: string[];

  @Prop({ default: 0 })
  cardCount: number;

  @Prop({ type: Date })
  lastStudiedAt?: Date;
}

export const DeckSchema = SchemaFactory.createForClass(Deck);

DeckSchema.index({ title: 'text', description: 'text', tags: 'text' });
