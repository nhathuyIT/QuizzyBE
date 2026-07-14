import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type AdminAuditLogDocument = AdminAuditLog & Document;

@Schema({
  collection: 'admin_audit_logs',
  timestamps: { createdAt: true, updatedAt: false },
})
export class AdminAuditLog {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  adminId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  action!: string;

  @Prop({
    required: true,
    enum: [
      'user',
      'deck',
      'academic_department',
      'academic_subject',
      'academic_document',
    ],
    index: true,
  })
  targetType!:
    | 'user'
    | 'deck'
    | 'academic_department'
    | 'academic_subject'
    | 'academic_document';

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, index: true })
  targetId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  metadata!: Record<string, unknown>;
}

export const AdminAuditLogSchema = SchemaFactory.createForClass(AdminAuditLog);

AdminAuditLogSchema.index({ createdAt: -1, action: 1 });
AdminAuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
