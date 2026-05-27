import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBulkCardsDto } from './dto/create-bulk-cards.dto';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { CardRepository } from './card.repository';

@Injectable()
export class CardService {
  constructor(private readonly cardRepository: CardRepository) {}

  async createCard(createCardDto: CreateCardDto) {
    return this.cardRepository.create(createCardDto);
  }

  async createBulkCards(createBulkCardsDto: CreateBulkCardsDto) {
    return this.cardRepository.insertMany(createBulkCardsDto.cards);
  }
  async findAll() {
    return this.cardRepository.findAll();
  }
  async findByDeckId(deckId: string) {
    const deck = await this.cardRepository.findByDeckId(deckId);
    if (!deck) {
      throw new NotFoundException('Deck không tồn tại trên hệ thống');
    }
    return deck;
  }
  async findById(id: string) {
    const card = await this.cardRepository.findById(id);
    if (!card) {
      throw new NotFoundException('Thẻ flashcard không tồn tại trên hệ thống');
    }
    return card;
  }
  async updateCard(id: string, updateCardDto: UpdateCardDto) {
    const card = await this.cardRepository.updateById(id, updateCardDto);
    if (!card) {
      throw new NotFoundException('Thẻ flashcard không tồn tại trên hệ thống');
    }

    return card;
  }
}
