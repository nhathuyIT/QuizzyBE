import { Injectable, NotFoundException } from '@nestjs/common';
import { QuerySubjectsDto } from '../dto/query-subjects.dto';
import { DepartmentRepository } from '../repositories/department.repository';
import { SubjectRepository } from '../repositories/subject.repository';
import { SubjectDocument } from '../schemas/subject.schema';

@Injectable()
export class SubjectService {
  constructor(
    private readonly departmentRepository: DepartmentRepository,
    private readonly subjectRepository: SubjectRepository,
  ) {}

  async findByDepartment(departmentId: string, query: QuerySubjectsDto) {
    const department =
      await this.departmentRepository.findActiveById(departmentId);

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    const subjects = await this.subjectRepository.findActiveByDepartment(
      departmentId,
      query.semester,
    );

    return subjects.map((subject) => this.toResponse(subject));
  }

  private toResponse(subject: SubjectDocument) {
    const plain = subject.toObject() as Record<string, unknown>;

    return {
      ...plain,
      _id: subject._id.toString(),
      code: subject.code,
      name: subject.name,
      departmentId: subject.departmentId.toString(),
      semester: subject.semester,
      documentCount: subject.documentCount,
      isActive: subject.isActive,
      createdAt: plain.createdAt as Date,
      updatedAt: plain.updatedAt as Date,
    };
  }
}
