import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CardProgressModule } from '../card-progress/card-progress.module';
import { Card, CardSchema } from '../card/schemas/card.schema';
import { Deck, DeckSchema } from '../deck/schemas/deck.schema';
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
    CardProgressModule,
    MongooseModule.forFeature([
      { name: StudySession.name, schema: StudySessionSchema },
      { name: CardReview.name, schema: CardReviewSchema },
      { name: Deck.name, schema: DeckSchema },
      { name: Card.name, schema: CardSchema },
    ]),
  ],
  controllers: [StudyController],
  providers: [StudyService, StudyRepository],
  exports: [StudyService, StudyRepository],
})
export class StudyModule {}
