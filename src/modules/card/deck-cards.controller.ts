import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { CardService } from './card.service';
import { SearchDeckCardsDto } from './dto/search-deck-cards.dto';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe';

@Controller('v1/decks/:deckId/cards')
@UseGuards(JwtAuthGuard)
export class DeckCardsController {
  constructor(private readonly cardService: CardService) {}
  @Get()
  findDeckCards(
    @Param('deckId', new ParseMongoIdPipe()) deckId: string,
    @Query() searchDeckCardDto: SearchDeckCardsDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.cardService.findDeckCards(deckId, searchDeckCardDto, user.id);
  }
}
