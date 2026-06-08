import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PageDto } from '../../common/dto/page.dto';
import { PageMetaDto } from '../../common/dto/page-meta.dto';
import { CreateDeckDto } from './dto/create-deck.dto';
import { SearchDeckDto } from './dto/search-deck.dto';
import { UpdateDeckDto } from './dto/update-deck.dto';
import { DeckRepository } from './deck.repository';
import { DeckDocument } from './schemas/deck.schema';
import { isMongoId } from '../../common/utils/mongo-id.util';

@Injectable()
export class DeckService {
  constructor(private readonly deckRepository: DeckRepository) {}

  async createDeck(createDeckDto: CreateDeckDto, userId: string) {
    return this.deckRepository.create(createDeckDto, userId);
  }

  async searchDecks(searchDeckDto: SearchDeckDto) {
    const [decks, itemCount] = await this.deckRepository.search(searchDeckDto);
    const meta = new PageMetaDto({ pageOptionsDto: searchDeckDto, itemCount });

    return new PageDto<DeckDocument>(decks, meta);
  }
  async findById(id: string) {
    this.assertValidDeckId(id);

    const deck = await this.deckRepository.findById(id);
    if (!deck) {
      throw new NotFoundException('Bộ học tập này không tồn tại trên hệ thống');
    }
    return deck;
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
    this.assertValidDeckId(deckId);

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
  async updateCardCount(deckId: string, count: number) {
    this.assertValidDeckId(deckId);

    return this.deckRepository.updateCardCount(deckId, count);
  }

  private assertValidDeckId(deckId: string) {
    if (!isMongoId(deckId)) {
      throw new BadRequestException('deckId must be a valid MongoDB ObjectId');
    }
  }
}
