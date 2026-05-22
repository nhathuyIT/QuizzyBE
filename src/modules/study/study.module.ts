import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StudyController } from './study.controller';
import { StudyRepository } from './study.repository';
import { StudyService } from './study.service';
import { CardReview, CardReviewSchema } from './schemas/card-review.schema';
import {
  StudySession,
  StudySessionSchema,
} from './schemas/study-session.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StudySession.name, schema: StudySessionSchema },
      { name: CardReview.name, schema: CardReviewSchema },
    ]),
  ],
  controllers: [StudyController],
  providers: [StudyService, StudyRepository],
  exports: [StudyService, StudyRepository],
})
export class StudyModule {}
