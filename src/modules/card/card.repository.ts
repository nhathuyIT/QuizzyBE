import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { Card, CardDocument } from './schemas/card.schema';

@Injectable()
export class CardRepository {
  constructor(
    @InjectModel(Card.name)
    private readonly cardModel: Model<CardDocument>,
  ) {}

  async create(createCardDto: CreateCardDto): Promise<CardDocument> {
    return this.cardModel.create({
      ...createCardDto,
      deckId: new Types.ObjectId(createCardDto.deckId),
    });
  }

  async insertMany(cards: CreateCardDto[]): Promise<CardDocument[]> {
    return this.cardModel.insertMany(
      cards.map((card) => ({
        ...card,
        deckId: new Types.ObjectId(card.deckId),
        examples: card.examples ?? [],
      })),
    );
  }
  async findAll(): Promise<CardDocument[]> {
    return this.cardModel.find().exec();
  }
  async findById(id: string): Promise<CardDocument | null> {
    return this.cardModel.findById(id).exec();
  }

  async findByDeckId(deckId: string): Promise<CardDocument[]> {
    return this.cardModel
      .find({ deckId: new Types.ObjectId(deckId) })
      .sort({ position: 1 })
      .exec();
  }

  async updateById(
    id: string,
    updateCardDto: UpdateCardDto,
  ): Promise<CardDocument | null> {
    return this.cardModel
      .findByIdAndUpdate(id, updateCardDto, { new: true })
      .exec();
  }
  async findByDeckIdPaginated(
    deckId: string,
    page: number,
    take: number,
  ): Promise<[CardDocument[], number]> {
    const filter = { deckId: new Types.ObjectId(deckId) };
    const query = this.cardModel
      .find(filter)
      .sort({ position: 1 })
      .skip((page - 1) * take)
      .limit(take);
    return Promise.all([
      query.exec(),
      this.cardModel.countDocuments(filter).exec(),
    ]);
  }
}
