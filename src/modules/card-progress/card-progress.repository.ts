import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Card, CardDocument } from '../card/schemas/card.schema';
import { Deck, DeckDocument } from '../deck/schemas/deck.schema';
import { UpsertCardProgressDto } from './dto/upsert-card-progress.dto';
import {
  CardProgress,
  CardProgressDocument,
} from './schemas/card-progress.schema';

export interface CardProgressUpdate {
  mastery: number;
  status: 'new' | 'learning' | 'review' | 'mastered';
  easeFactor: number;
  intervalDays: number;
  dueAt: Date;
  correctCount: number;
  wrongCount: number;
}

@Injectable()
export class CardProgressRepository {
  constructor(
    @InjectModel(CardProgress.name)
    private readonly cardProgressModel: Model<CardProgressDocument>,
    @InjectModel(Card.name)
    private readonly cardModel: Model<CardDocument>,
    @InjectModel(Deck.name)
    private readonly deckModel: Model<DeckDocument>,
  ) {}

  async findDeckById(deckId: string): Promise<DeckDocument | null> {
    return this.deckModel.findById(deckId).exec();
  }

  async findCardById(cardId: string): Promise<CardDocument | null> {
    return this.cardModel.findById(cardId).exec();
  }

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

  async findByUserAndCard(
    userId: string,
    cardId: string,
  ): Promise<CardProgressDocument | null> {
    return this.cardProgressModel
      .findOne({
        userId: new Types.ObjectId(userId),
        cardId: new Types.ObjectId(cardId),
      })
      .exec();
  }

  async upsertReviewProgress(
    userId: string,
    deckId: string,
    cardId: string,
    progress: CardProgressUpdate,
  ): Promise<CardProgressDocument> {
    return this.cardProgressModel
      .findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          cardId: new Types.ObjectId(cardId),
        },
        {
          $set: {
            ...progress,
            deckId: new Types.ObjectId(deckId),
          },
          $setOnInsert: {
            userId: new Types.ObjectId(userId),
            cardId: new Types.ObjectId(cardId),
          },
        },
        { new: true, upsert: true },
      )
      .exec();
  }

  async initializeDeckProgress(userId: string, deckId: string): Promise<void> {
    const userObjectId = new Types.ObjectId(userId);
    const deckObjectId = new Types.ObjectId(deckId);
    const cards = await this.cardModel
      .find({ deckId: deckObjectId })
      .select('_id')
      .exec();

    if (cards.length === 0) {
      return;
    }

    const now = new Date();
    await this.cardProgressModel.bulkWrite(
      cards.map((card) => ({
        updateOne: {
          filter: {
            userId: userObjectId,
            cardId: card._id,
          },
          update: {
            $setOnInsert: {
              userId: userObjectId,
              cardId: card._id,
              deckId: deckObjectId,
              mastery: 0,
              status: 'new',
              easeFactor: 2.5,
              intervalDays: 0,
              dueAt: now,
              correctCount: 0,
              wrongCount: 0,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
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

  async getDeckSummary(userId: string, deckId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const deckObjectId = new Types.ObjectId(deckId);
    const [statusCounts, dueToday] = await Promise.all([
      this.cardProgressModel
        .aggregate<{ _id: string; count: number }>([
          {
            $match: {
              userId: userObjectId,
              deckId: deckObjectId,
            },
          },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
        ])
        .exec(),
      this.cardProgressModel.countDocuments({
        userId: userObjectId,
        deckId: deckObjectId,
        dueAt: { $lte: new Date() },
      }),
    ]);
    const summary = {
      total: 0,
      new: 0,
      learning: 0,
      review: 0,
      mastered: 0,
      dueToday,
    };

    for (const item of statusCounts) {
      if (item._id in summary) {
        summary[item._id as 'new' | 'learning' | 'review' | 'mastered'] =
          item.count;
      }
      summary.total += item.count;
    }

    return summary;
  }
}
