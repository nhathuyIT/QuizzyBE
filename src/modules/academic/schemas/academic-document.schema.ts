import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type AcademicDocumentDoc = AcademicDocument & Document;
export type AcademicDocumentFileType =
  | 'pdf'
  | 'docx'
  | 'pptx'
  | 'xlsx'
  | 'other';
export type AcademicDocumentStatus = 'active' | 'archived';

@Schema({ collection: 'academic_documents', timestamps: true })
export class AcademicDocument {
  @Prop({ required: true, trim: true, maxlength: 200 })
  title!: string;

  @Prop({ trim: true, maxlength: 500 })
  description?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Subject',
    required: true,
    index: true,
  })
  subjectId!: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  uploadedBy!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  fileUrl!: string;

  @Prop({ required: true, trim: true })
  fileName!: string;

  @Prop({
    required: true,
    enum: ['pdf', 'docx', 'pptx', 'xlsx', 'other'],
  })
  fileType!: AcademicDocumentFileType;

  @Prop({ required: true, min: 1 })
  fileSize!: number;

  @Prop({ required: true, trim: true })
  storagePath!: string;

  @Prop({ default: 'active', enum: ['active', 'archived'], index: true })
  status!: AcademicDocumentStatus;

  @Prop({ default: 0 })
  downloadCount!: number;

  @Prop({ type: [String], default: [], index: true })
  tags!: string[];
}

export const AcademicDocumentSchema =
  SchemaFactory.createForClass(AcademicDocument);

AcademicDocumentSchema.index({ subjectId: 1, createdAt: -1 });
AcademicDocumentSchema.index({ uploadedBy: 1, createdAt: -1 });
AcademicDocumentSchema.index({
  title: 'text',
  description: 'text',
  tags: 'text',
});
