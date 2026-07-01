import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Subject, SubjectDocument } from '../schemas/subject.schema';

@Injectable()
export class SubjectRepository {
  constructor(
    @InjectModel(Subject.name)
    private readonly subjectModel: Model<SubjectDocument>,
  ) {}

  async findActiveByDepartment(
    departmentId: string,
    semester?: number,
  ): Promise<SubjectDocument[]> {
    const filter: Record<string, unknown> = {
      departmentId: new Types.ObjectId(departmentId),
      isActive: true,
    };

    if (semester) {
      filter.semester = semester;
    }

    return this.subjectModel.find(filter).sort({ semester: 1, code: 1 }).exec();
  }

  async findActiveById(id: string): Promise<SubjectDocument | null> {
    return this.subjectModel.findOne({ _id: id, isActive: true }).exec();
  }

  async incrementDocumentCount(
    subjectId: string,
    amount: number,
  ): Promise<void> {
    await this.subjectModel
      .updateOne(
        { _id: new Types.ObjectId(subjectId) },
        { $inc: { documentCount: amount } },
      )
      .exec();
  }
}
