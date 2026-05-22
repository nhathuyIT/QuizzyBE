import { Exclude, Expose, Transform } from 'class-transformer';
import { Types } from 'mongoose';

export abstract class AbstractDto {
  @Expose()
  @Transform(({ obj }: { obj: { _id?: Types.ObjectId; id?: string } }) =>
    obj._id ? obj._id.toString() : obj.id,
  )
  id!: string;

  @Expose()
  createdAt?: Date;

  @Expose()
  updatedAt?: Date;

  @Exclude()
  _id?: Types.ObjectId;

  @Exclude()
  __v?: number;
}
