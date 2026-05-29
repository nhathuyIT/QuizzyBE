import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateBulkCardsDto } from './dto/create-bulk-cards.dto';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { CardRepository } from './card.repository';
import { DeckService } from '../deck/deck.service';

@Injectable()
export class CardService {
  constructor(
    private readonly cardRepository: CardRepository,
    private readonly deckService: DeckService,
  ) {}

  async createCard(createCardDto: CreateCardDto, userId: string) {
    await this.deckService.validateDeckOwner(createCardDto.deckId, userId);
    const card = await this.cardRepository.create(createCardDto);
    await this.deckService.updateCardCount(createCardDto.deckId, 1);
    return card;
  }

  async createBulkCards(
    createBulkCardsDto: CreateBulkCardsDto,
    userId: string,
  ) {
    const deckId = createBulkCardsDto.cards[0].deckId;
    if (!deckId) {
      throw new NotFoundException('Danh sách thẻ trống');
    }
    const hasDifferentDecks = createBulkCardsDto.cards.some(
      (card) => card.deckId !== deckId,
    );
    if (hasDifferentDecks) {
      throw new BadRequestException('Tất cả thẻ phải thuộc cùng một bộ');
    }
    await this.deckService.validateDeckOwner(deckId, userId);
    const cards = await this.cardRepository.insertMany(
      createBulkCardsDto.cards,
    );
    await this.deckService.updateCardCount(deckId, cards.length);
    return cards;
  }
  async findAll() {
    return this.cardRepository.findAll();
  }
  async findByDeckId(deckId: string) {
    await this.deckService.findById(deckId);
    return this.cardRepository.findByDeckId(deckId);
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
