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

  async findByDeckId(deckId: string) {
    return this.cardRepository.findByDeckId(deckId);
  }

  async updateCard(id: string, updateCardDto: UpdateCardDto) {
    const card = await this.cardRepository.updateById(id, updateCardDto);
    if (!card) {
      throw new NotFoundException('Thẻ flashcard không tồn tại trên hệ thống');
    }

    return card;
  }
}
