import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DeckController } from './deck.controller';
import { DeckRepository } from './deck.repository';
import { DeckService } from './deck.service';
import { Deck, DeckSchema } from './schemas/deck.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Deck.name, schema: DeckSchema }]),
  ],
  controllers: [DeckController],
  providers: [DeckService, DeckRepository],
  exports: [DeckService, DeckRepository],
})
export class DeckModule {}
