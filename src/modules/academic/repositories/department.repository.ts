import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Department, DepartmentDocument } from '../schemas/department.schema';

@Injectable()
export class DepartmentRepository {
  constructor(
    @InjectModel(Department.name)
    private readonly departmentModel: Model<DepartmentDocument>,
  ) {}

  async findActive(): Promise<DepartmentDocument[]> {
    return this.departmentModel
      .find({ isActive: true })
      .sort({ code: 1 })
      .exec();
  }

  async findActiveById(id: string): Promise<DepartmentDocument | null> {
    return this.departmentModel.findOne({ _id: id, isActive: true }).exec();
  }
}
