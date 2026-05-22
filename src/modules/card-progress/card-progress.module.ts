import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CardProgressController } from './card-progress.controller';
import { CardProgressRepository } from './card-progress.repository';
import { CardProgressService } from './card-progress.service';
import {
  CardProgress,
  CardProgressSchema,
} from './schemas/card-progress.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CardProgress.name, schema: CardProgressSchema },
    ]),
  ],
  controllers: [CardProgressController],
  providers: [CardProgressService, CardProgressRepository],
  exports: [CardProgressService, CardProgressRepository],
})
export class CardProgressModule {}
