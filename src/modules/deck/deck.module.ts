import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DeckController } from './deck.controller';
import { DeckRepository } from './deck.repository';
import { DeckService } from './deck.service';
import { Deck, DeckSchema } from './schemas/deck.schema';
import { DeckStar, DeckStarSchema } from './schemas/deck-star.schema';
import { Card, CardSchema } from '../card/schemas/card.schema';
import { CardService } from '../card/card.service';
import { CardRepository } from '../card/card.repository';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Card.name, schema: CardSchema }]),
    MongooseModule.forFeature([
      { name: Deck.name, schema: DeckSchema },
      { name: DeckStar.name, schema: DeckStarSchema },
    ]),
  ],
  controllers: [DeckController],
  providers: [CardService, CardRepository, DeckService, DeckRepository],
  exports: [DeckService, DeckRepository, CardService, CardRepository],
})
export class DeckModule {}
