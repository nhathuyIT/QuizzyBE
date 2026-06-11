import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { CardService } from './card.service';
import { SearchDeckCardsDto } from './dto/search-deck-cards.dto';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators';

@Controller('v1/decks/:deckId/cards')
@UseGuards(JwtAuthGuard)
export class DeckCardsController {
  constructor(private readonly cardService: CardService) {}
  @Get()
  findDeckCards(
    @Param('deckId') deckId: string,
    @Query() searchDeckCardDto: SearchDeckCardsDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    void user;
    return this.cardService.findDeckCards(deckId, searchDeckCardDto);
  }
}
