import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AcademicDocument,
  AcademicDocumentSchema,
} from '../academic/schemas/academic-document.schema';
import {
  Department,
  DepartmentSchema,
} from '../academic/schemas/department.schema';
import { Subject, SubjectSchema } from '../academic/schemas/subject.schema';
import { Card, CardSchema } from '../card/schemas/card.schema';
import { Deck, DeckSchema } from '../deck/schemas/deck.schema';
import {
  CardReview,
  CardReviewSchema,
} from '../study/schemas/card-review.schema';
import {
  StudySession,
  StudySessionSchema,
} from '../study/schemas/study-session.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { AdminController } from './admin.controller';
import { AdminRepository } from './admin.repository';
import { AdminService } from './admin.service';
import {
  AdminAuditLog,
  AdminAuditLogSchema,
} from './schemas/admin-audit-log.schema';
import { AdminAcademicController } from './admin-academic.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Deck.name, schema: DeckSchema },
      { name: Card.name, schema: CardSchema },
      { name: StudySession.name, schema: StudySessionSchema },
      { name: CardReview.name, schema: CardReviewSchema },
      { name: AdminAuditLog.name, schema: AdminAuditLogSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: Subject.name, schema: SubjectSchema },
      { name: AcademicDocument.name, schema: AcademicDocumentSchema },
    ]),
  ],
  controllers: [AdminController, AdminAcademicController],
  providers: [AdminRepository, AdminService, RolesGuard],
})
export class AdminModule {}
