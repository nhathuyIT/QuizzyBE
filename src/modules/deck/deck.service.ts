import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PageDto } from '../../common/dto/page.dto';
import { PageMetaDto } from '../../common/dto/page-meta.dto';
import {
  DeckSourceType,
  DeckVisibility,
} from '../../common/enums/deck-visibility.enum';
import { isMongoId } from '../../common/utils/mongo-id.util';
import { DeckRepository } from './deck.repository';
import { CreateDeckDto } from './dto/create-deck.dto';
import { SearchDeckDto } from './dto/search-deck.dto';
import { UpdateDeckDto } from './dto/update-deck.dto';
import { DeckResponse } from './interface/deck.interface';
import { DeckDocument } from './schemas/deck.schema';

@Injectable()
export class DeckService {
  constructor(private readonly deckRepository: DeckRepository) {}

  async createDeck(createDeckDto: CreateDeckDto, userId: string) {
    const deck = await this.deckRepository.create(createDeckDto, userId);

    return this.toDeckResponse(deck, false);
  }

  async searchDecks(searchDeckDto: SearchDeckDto, userId?: string) {
    const [decks, itemCount] = await this.deckRepository.search(
      searchDeckDto,
      userId,
    );
    const meta = new PageMetaDto({ pageOptionsDto: searchDeckDto, itemCount });
    const starredDeckIds = await this.getStarredDeckIds(userId, decks);
    const data = decks.map((deck) =>
      this.toDeckResponse(deck, starredDeckIds.has(deck._id.toString())),
    );

    return new PageDto<DeckResponse>(data, meta);
  }

  async findMyDecks(searchDeckDto: SearchDeckDto, userId: string) {
    const [decks, itemCount] = await this.deckRepository.searchByUser(
      searchDeckDto,
      userId,
    );
    const meta = new PageMetaDto({ pageOptionsDto: searchDeckDto, itemCount });
    const starredDeckIds = await this.getStarredDeckIds(userId, decks);
    const data = decks.map((deck) =>
      this.toDeckResponse(deck, starredDeckIds.has(deck._id.toString())),
    );

    return new PageDto<DeckResponse>(data, meta);
  }

  async searchStarredDecks(searchDeckDto: SearchDeckDto, userId: string) {
    const [decks, itemCount] = await this.deckRepository.searchStarred(
      userId,
      searchDeckDto,
    );
    const meta = new PageMetaDto({ pageOptionsDto: searchDeckDto, itemCount });

    return new PageDto<DeckResponse>(
      decks.map((deck) => this.toDeckResponse(deck, true)),
      meta,
    );
  }

  async findById(id: string, userId?: string) {
    this.assertValidDeckId(id);

    const deck = await this.deckRepository.findById(id);
    if (!deck || !this.canReadDeck(deck, userId)) {
      throw new NotFoundException('Deck not found');
    }

    const star = userId
      ? await this.deckRepository.isDeckStarred(userId, id)
      : false;

    return this.toDeckResponse(deck, star);
  }

  async updateDeck(
    deckId: string,
    updateDeckDto: UpdateDeckDto,
    userId: string,
  ) {
    await this.validateDeckOwner(deckId, userId);
    const deck = await this.deckRepository.updateById(deckId, updateDeckDto);

    if (!deck || deck.deletedAt) {
      throw new NotFoundException('Deck not found');
    }

    const star = await this.deckRepository.isDeckStarred(userId, deckId);

    return this.toDeckResponse(deck, star);
  }

  async starDeck(deckId: string, userId: string) {
    const deck = await this.findAccessibleDeck(deckId, userId);

    await this.deckRepository.starDeck(userId, deckId);

    return this.toDeckResponse(deck, true);
  }

  async unstarDeck(deckId: string, userId: string) {
    const deck = await this.findAccessibleDeck(deckId, userId);

    await this.deckRepository.unstarDeck(userId, deckId);

    return this.toDeckResponse(deck, false);
  }

  async validateDeckOwner(deckId: string, userId: string) {
    this.assertValidDeckId(deckId);

    const deck = await this.deckRepository.findById(deckId);
    if (!deck || deck.deletedAt) {
      throw new NotFoundException('Deck not found');
    }

    if (deck.createdBy.toString() !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this deck',
      );
    }

    return deck;
  }

  async updateCardCount(deckId: string, count: number) {
    this.assertValidDeckId(deckId);

    return this.deckRepository.updateCardCount(deckId, count);
  }

  private async findAccessibleDeck(deckId: string, userId: string) {
    this.assertValidDeckId(deckId);

    const deck = await this.deckRepository.findById(deckId);
    if (!deck) {
      throw new NotFoundException('Deck not found');
    }

    if (!this.canAccessDeck(deck, userId)) {
      throw new ForbiddenException(
        'You do not have permission to access this deck',
      );
    }

    return deck;
  }

  private canAccessDeck(deck: DeckDocument, userId: string) {
    const isOwner = deck.createdBy.toString() === userId;
    return (
      !deck.deletedAt &&
      (isOwner ||
        (deck.visibility !== 'private' && deck.moderationStatus !== 'hidden'))
    );
  }

  private canReadDeck(deck: DeckDocument, userId?: string) {
    const isOwner = userId ? deck.createdBy.toString() === userId : false;
    return (
      !deck.deletedAt &&
      (isOwner ||
        (deck.visibility !== 'private' && deck.moderationStatus !== 'hidden'))
    );
  }

  private async getStarredDeckIds(
    userId: string | undefined,
    decks: DeckDocument[],
  ) {
    if (!userId || decks.length === 0) {
      return new Set<string>();
    }

    return this.deckRepository.findStarredDeckIds(
      userId,
      decks.map((deck) => deck._id.toString()),
    );
  }

  private toDeckResponse(deck: DeckDocument, star: boolean): DeckResponse {
    const plain = deck.toObject() as Record<string, unknown>;

    return {
      ...plain,
      _id: deck._id.toString(),
      title: deck.title,
      description: deck.description,
      visibility: deck.visibility as DeckVisibility,
      createdBy: deck.createdBy.toString(),
      star,
      sourceType: deck.sourceType as DeckSourceType,
      tags: deck.tags,
      cardCount: deck.cardCount,
      lastStudiedAt: deck.lastStudiedAt,
      createdAt: plain.createdAt as Date,
      updatedAt: plain.updatedAt as Date,
    };
  }

  private assertValidDeckId(deckId: string) {
    if (!isMongoId(deckId)) {
      throw new BadRequestException('deckId must be a valid MongoDB ObjectId');
    }
  }
}
