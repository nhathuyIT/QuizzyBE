import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DeckService } from './deck.service';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { CreateDeckDto } from './dto/create-deck.dto';
import { SearchDeckDto } from './dto/search-deck.dto';
import { UpdateDeckDto } from './dto/update-deck.dto';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators';
@Controller('v1/decks')
@UseGuards(JwtAuthGuard)
export class DeckController {
  constructor(private readonly deckService: DeckService) {}
  @Post()
  create(
    @Body() createDeckDto: CreateDeckDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.deckService.createDeck(createDeckDto, user.id);
  }
  @Get()
  search(@Query() searchDeckDto: SearchDeckDto) {
    return this.deckService.searchDecks(searchDeckDto);
  }
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.deckService.findById(id);
  }
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDeckDto: UpdateDeckDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.deckService.updateDeck(id, updateDeckDto, user.id);
  }
}
