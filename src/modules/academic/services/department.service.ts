import { Injectable } from '@nestjs/common';
import { DepartmentRepository } from '../repositories/department.repository';
import { DepartmentDocument } from '../schemas/department.schema';

@Injectable()
export class DepartmentService {
  constructor(private readonly departmentRepository: DepartmentRepository) {}

  async findAll() {
    const departments = await this.departmentRepository.findActive();

    return departments.map((department) => this.toResponse(department));
  }

  private toResponse(department: DepartmentDocument) {
    const plain = department.toObject() as Record<string, unknown>;

    return {
      ...plain,
      _id: department._id.toString(),
      code: department.code,
      name: department.name,
      description: department.description,
      isActive: department.isActive,
      createdAt: plain.createdAt as Date,
      updatedAt: plain.updatedAt as Date,
    };
  }
}
