import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CardController } from './card.controller';
import { CardRepository } from './card.repository';
import { CardService } from './card.service';
import { Card, CardSchema } from './schemas/card.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Card.name, schema: CardSchema }]),
  ],
  controllers: [CardController],
  providers: [CardService, CardRepository],
  exports: [CardService, CardRepository],
})
export class CardModule {}
