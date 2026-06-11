import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CardProgressModule } from '../card-progress/card-progress.module';
import { Card, CardSchema } from '../card/schemas/card.schema';
import { Deck, DeckSchema } from '../deck/schemas/deck.schema';
import {
  CardReviewEntity,
  CardReviewSchema,
} from './schemas/card-review.schema';
import {
  StudySessionEntity,
  StudySessionSchema,
} from './schemas/study-session.schema';
import { StudySessionController } from './study-session.controller';
import { StudySessionRepository } from './study-session.repository';
import { StudySessionService } from './study-session.service';

@Module({
  imports: [
    CardProgressModule,
    MongooseModule.forFeature([
      { name: StudySessionEntity.name, schema: StudySessionSchema },
      { name: CardReviewEntity.name, schema: CardReviewSchema },
      { name: Deck.name, schema: DeckSchema },
      { name: Card.name, schema: CardSchema },
    ]),
  ],
  controllers: [StudySessionController],
  providers: [StudySessionService, StudySessionRepository],
  exports: [StudySessionService, StudySessionRepository],
})
export class StudySessionModule {}
