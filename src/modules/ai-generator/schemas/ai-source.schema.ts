import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type AiSourceDocument = AiSource & Document;
export type AiSourceType =
  | 'text'
  | 'pdf'
  | 'url'
  | 'image'
  | 'academic_document';

@Schema({ collection: 'ai_sources', timestamps: true })
export class AiSource {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId!: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['text', 'pdf', 'url', 'image', 'academic_document'],
  })
  type!: AiSourceType;

  @Prop({ required: true })
  title!: string;

  @Prop()
  rawText?: string;

  @Prop()
  fileUrl?: string;

  @Prop()
  storagePath?: string;

  @Prop()
  fileType?: string;

  @Prop()
  extractedText?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'AcademicDocument',
    index: true,
  })
  academicDocumentId?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Subject', index: true })
  subjectId?: Types.ObjectId;

  @Prop({ default: 'uploaded', enum: ['uploaded', 'parsed', 'failed'] })
  status!: string;
}

export const AiSourceSchema = SchemaFactory.createForClass(AiSource);
