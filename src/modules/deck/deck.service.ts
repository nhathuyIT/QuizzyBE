import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateDeckDto } from './dto/create-deck.dto';
import { SearchDeckDto } from './dto/search-deck.dto';
import { UpdateDeckDto } from './dto/update-deck.dto';
import { DeckRepository } from './deck.repository';

@Injectable()
export class DeckService {
  constructor(private readonly deckRepository: DeckRepository) {}

  async createDeck(createDeckDto: CreateDeckDto, userId: string) {
    return this.deckRepository.create(createDeckDto, userId);
  }

  async searchDecks(searchDeckDto: SearchDeckDto) {
    return this.deckRepository.search(searchDeckDto);
  }

  async updateDeck(
    deckId: string,
    updateDeckDto: UpdateDeckDto,
    userId: string,
  ) {
    await this.validateDeckOwner(deckId, userId);
    return this.deckRepository.updateById(deckId, updateDeckDto);
  }

  async validateDeckOwner(deckId: string, userId: string) {
    const deck = await this.deckRepository.findById(deckId);
    if (!deck) {
      throw new NotFoundException('Bộ học tập này không tồn tại trên hệ thống');
    }

    if (deck.createdBy.toString() !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền chỉnh sửa bộ bài của người khác',
      );
    }

    return deck;
  }
}
