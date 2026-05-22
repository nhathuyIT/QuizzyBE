import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ _id: false })
class StreakInfo {
  @Prop({ default: 0 })
  current: number;

  @Prop({ default: 0 })
  longest: number;

  @Prop({ type: Date })
  lastActive?: Date;
}

@Schema({ _id: false })
class UserPreferences {
  @Prop({ default: 'light', enum: ['light', 'dark'] })
  theme: string;

  @Prop({ default: 'vi', enum: ['vi', 'en'] })
  language: string;
}

@Schema({ collection: 'users', timestamps: true })
export class User {
  @Prop({ required: true, unique: true, trim: true, index: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true })
  name: string;

  @Prop({ default: 'student', enum: ['student', 'teacher', 'admin'] })
  role: string;

  @Prop()
  avatarUrl?: string;

  @Prop({ default: 0 })
  totalPoints: number;

  @Prop({ type: StreakInfo, default: () => ({ current: 0, longest: 0 }) })
  streak: StreakInfo;

  @Prop({
    type: UserPreferences,
    default: () => ({ theme: 'light', language: 'vi' }),
  })
  preferences: UserPreferences;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
