import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type CardDocument = Card & Document;

@Schema({ collection: 'cards', timestamps: true })
export class Card {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Deck',
    required: true,
    index: true,
  })
  deckId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  front!: string;

  @Prop({ required: true, trim: true })
  back!: string;

  @Prop()
  hint?: string;

  @Prop()
  explanation?: string;

  @Prop()
  imageUrl?: string;

  @Prop({ type: [String], default: [] })
  examples!: string[];

  @Prop({ required: true, default: 0 })
  position!: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'AiGenerationJob' })
  aiJobId?: Types.ObjectId;
}

export const CardSchema = SchemaFactory.createForClass(Card);

CardSchema.index({ deckId: 1, position: 1 });
