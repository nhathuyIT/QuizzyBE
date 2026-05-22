import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UpsertCardProgressDto } from './dto/upsert-card-progress.dto';
import {
  CardProgress,
  CardProgressDocument,
} from './schemas/card-progress.schema';

@Injectable()
export class CardProgressRepository {
  constructor(
    @InjectModel(CardProgress.name)
    private readonly cardProgressModel: Model<CardProgressDocument>,
  ) {}

  async upsertByUserAndCard(
    userId: string,
    upsertCardProgressDto: UpsertCardProgressDto,
  ): Promise<CardProgressDocument> {
    return this.cardProgressModel
      .findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          cardId: new Types.ObjectId(upsertCardProgressDto.cardId),
        },
        {
          ...upsertCardProgressDto,
          userId: new Types.ObjectId(userId),
          cardId: new Types.ObjectId(upsertCardProgressDto.cardId),
          deckId: new Types.ObjectId(upsertCardProgressDto.deckId),
        },
        { new: true, upsert: true },
      )
      .exec();
  }

  async findDueCards(
    userId: string,
    deckId: string,
    dueAt: Date = new Date(),
  ): Promise<CardProgressDocument[]> {
    return this.cardProgressModel
      .find({
        userId: new Types.ObjectId(userId),
        deckId: new Types.ObjectId(deckId),
        dueAt: { $lte: dueAt },
      })
      .sort({ dueAt: 1 })
      .exec();
  }
}
