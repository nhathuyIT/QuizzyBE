import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CardProgressController } from './card-progress.controller';
import { CardProgressRepository } from './card-progress.repository';
import { CardProgressService } from './card-progress.service';
import { Card, CardSchema } from '../card/schemas/card.schema';
import { Deck, DeckSchema } from '../deck/schemas/deck.schema';
import {
  CardProgress,
  CardProgressSchema,
} from './schemas/card-progress.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CardProgress.name, schema: CardProgressSchema },
      { name: Card.name, schema: CardSchema },
      { name: Deck.name, schema: DeckSchema },
    ]),
  ],
  controllers: [CardProgressController],
  providers: [CardProgressService, CardProgressRepository],
  exports: [CardProgressService, CardProgressRepository],
})
export class CardProgressModule {}
