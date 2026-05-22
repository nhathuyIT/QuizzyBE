import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateDeckDto } from './dto/create-deck.dto';
import { SearchDeckDto } from './dto/search-deck.dto';
import { UpdateDeckDto } from './dto/update-deck.dto';
import { Deck, DeckDocument } from './schemas/deck.schema';

@Injectable()
export class DeckRepository {
  constructor(
    @InjectModel(Deck.name)
    private readonly deckModel: Model<DeckDocument>,
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
  ): Promise<[DeckDocument[], number]> {
    const { keyword, visibility } = searchDeckDto;
    const filter: Record<string, unknown> = {};

    if (keyword) {
      filter.$text = { $search: keyword };
    }

    if (visibility) {
      filter.visibility = visibility;
    }

    const query = this.deckModel
      .find(filter)
      .skip(searchDeckDto.skip)
      .limit(searchDeckDto.take)
      .sort({ updatedAt: searchDeckDto.order === 'ASC' ? 1 : -1 });

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
}
