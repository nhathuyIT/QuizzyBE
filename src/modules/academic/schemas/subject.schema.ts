import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type SubjectDocument = Subject & Document;

@Schema({ collection: 'subjects', timestamps: true })
export class Subject {
  @Prop({ required: true, trim: true, uppercase: true })
  code!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Department',
    required: true,
    index: true,
  })
  departmentId!: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 9 })
  semester!: number;

  @Prop({ default: 0 })
  documentCount!: number;

  @Prop({ default: true, index: true })
  isActive!: boolean;
}

export const SubjectSchema = SchemaFactory.createForClass(Subject);

SubjectSchema.index({ code: 1, departmentId: 1 }, { unique: true });
SubjectSchema.index({ departmentId: 1, semester: 1 });
