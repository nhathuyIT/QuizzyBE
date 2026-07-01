import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentController } from './controllers/document.controller';
import { DepartmentController } from './controllers/department.controller';
import { SubjectController } from './controllers/subject.controller';
import { DepartmentRepository } from './repositories/department.repository';
import { DocumentRepository } from './repositories/document.repository';
import { SubjectRepository } from './repositories/subject.repository';
import { DepartmentService } from './services/department.service';
import { DocumentService } from './services/document.service';
import { SubjectService } from './services/subject.service';
import {
  AcademicDocument,
  AcademicDocumentSchema,
} from './schemas/academic-document.schema';
import { Department, DepartmentSchema } from './schemas/department.schema';
import { Subject, SubjectSchema } from './schemas/subject.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Department.name, schema: DepartmentSchema },
      { name: Subject.name, schema: SubjectSchema },
      { name: AcademicDocument.name, schema: AcademicDocumentSchema },
    ]),
  ],
  controllers: [DepartmentController, SubjectController, DocumentController],
  providers: [
    DepartmentRepository,
    SubjectRepository,
    DocumentRepository,
    DepartmentService,
    SubjectService,
    DocumentService,
  ],
  exports: [DepartmentService, SubjectService, DocumentService],
})
export class AcademicModule {}
