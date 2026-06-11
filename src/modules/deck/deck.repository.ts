import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateDeckDto } from './dto/create-deck.dto';
import { SearchDeckDto } from './dto/search-deck.dto';
import { UpdateDeckDto } from './dto/update-deck.dto';
import { Deck, DeckDocument } from './schemas/deck.schema';
import { DeckStar, DeckStarDocument } from './schemas/deck-star.schema';
import { Order } from '../../common/enums/order.enum';

@Injectable()
export class DeckRepository {
  constructor(
    @InjectModel(Deck.name)
    private readonly deckModel: Model<DeckDocument>,
    @InjectModel(DeckStar.name)
    private readonly deckStarModel: Model<DeckStarDocument>,
  ) {}

  async create(
    createDeckDto: CreateDeckDto,
    userId: string,
  ): Promise<DeckDocument> {
    return this.deckModel.create({
      ...createDeckDto,
      createdBy: new Types.ObjectId(userId),
    });
  }

  async findById(id: string): Promise<DeckDocument | null> {
    return this.deckModel.findById(id).exec();
  }

  async search(
    searchDeckDto: SearchDeckDto,
    userId?: string,
  ): Promise<[DeckDocument[], number]> {
    const filter = this.buildSearchFilter(searchDeckDto, userId);

    const query = this.deckModel
      .find(filter)
      .skip(searchDeckDto.skip)
      .limit(searchDeckDto.take)
      .sort({ updatedAt: searchDeckDto.order === Order.ASC ? 1 : -1 });

    return Promise.all([query.exec(), this.deckModel.countDocuments(filter)]);
  }

  async searchStarred(
    userId: string,
    searchDeckDto: SearchDeckDto,
  ): Promise<[DeckDocument[], number]> {
    const deckIds = await this.deckStarModel
      .distinct('deckId', { userId: new Types.ObjectId(userId) })
      .exec();

    if (!deckIds.length) {
      return [[], 0];
    }

    const filter = {
      ...this.buildSearchFilter(searchDeckDto, userId),
      _id: { $in: deckIds },
    };

    const query = this.deckModel
      .find(filter)
      .skip(searchDeckDto.skip)
      .limit(searchDeckDto.take)
      .sort({ updatedAt: searchDeckDto.order === Order.ASC ? 1 : -1 });

    return Promise.all([query.exec(), this.deckModel.countDocuments(filter)]);
  }

  async updateById(
    id: string,
    updateDeckDto: UpdateDeckDto,
  ): Promise<DeckDocument | null> {
    return this.deckModel
      .findByIdAndUpdate(id, updateDeckDto, { new: true })
      .exec();
  }

  async updateCardCount(deckId: string, count: number): Promise<void> {
    await this.deckModel
      .findByIdAndUpdate(deckId, { $inc: { cardCount: count } })
      .exec();
  }

  async starDeck(userId: string, deckId: string): Promise<void> {
    await this.deckStarModel
      .findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          deckId: new Types.ObjectId(deckId),
        },
        {
          $setOnInsert: {
            userId: new Types.ObjectId(userId),
            deckId: new Types.ObjectId(deckId),
          },
        },
        { upsert: true, new: true },
      )
      .exec();
  }

  async unstarDeck(userId: string, deckId: string): Promise<void> {
    await this.deckStarModel
      .deleteOne({
        userId: new Types.ObjectId(userId),
        deckId: new Types.ObjectId(deckId),
      })
      .exec();
  }

  async findStarredDeckIds(
    userId: string,
    deckIds?: string[],
  ): Promise<Set<string>> {
    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };

    if (deckIds?.length) {
      filter.deckId = {
        $in: deckIds.map((deckId) => new Types.ObjectId(deckId)),
      };
    }

    const stars = await this.deckStarModel.find(filter).select('deckId').exec();

    return new Set(stars.map((star) => star.deckId.toString()));
  }

  async isDeckStarred(userId: string, deckId: string): Promise<boolean> {
    const count = await this.deckStarModel
      .countDocuments({
        userId: new Types.ObjectId(userId),
        deckId: new Types.ObjectId(deckId),
      })
      .exec();

    return count > 0;
  }

  private buildSearchFilter(searchDeckDto: SearchDeckDto, userId?: string) {
    const { keyword, visibility } = searchDeckDto;
    const filter: Record<string, unknown> = {};

    if (keyword) {
      filter.$text = { $search: keyword };
    }

    if (visibility) {
      filter.visibility = visibility;
    }

    const accessFilter = userId
      ? {
          $or: [
            { visibility: { $ne: 'private' } },
            { createdBy: new Types.ObjectId(userId) },
          ],
        }
      : { visibility: { $ne: 'private' } };

    if (filter.visibility) {
      filter.$and = [accessFilter];
    } else {
      Object.assign(filter, accessFilter);
    }

    return filter;
  }
}
