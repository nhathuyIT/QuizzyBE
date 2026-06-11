import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DeckService } from './deck.service';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { CreateDeckDto } from './dto/create-deck.dto';
import { SearchDeckDto } from './dto/search-deck.dto';
import { UpdateDeckDto } from './dto/update-deck.dto';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe';
@Controller('v1/decks')
export class DeckController {
  constructor(private readonly deckService: DeckService) {}
  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() createDeckDto: CreateDeckDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.deckService.createDeck(createDeckDto, user.id);
  }
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  search(
    @Query() searchDeckDto: SearchDeckDto,
    @CurrentUser() user?: CurrentUserPayload,
  ) {
    return this.deckService.searchDecks(searchDeckDto, user?.id);
  }
  @Get('starred')
  @UseGuards(JwtAuthGuard)
  searchStarred(
    @Query() searchDeckDto: SearchDeckDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.deckService.searchStarredDecks(searchDeckDto, user.id);
  }
  @Get('my')
  @UseGuards(JwtAuthGuard)
  findMyDecks(
    @Query() searchDeckDto: SearchDeckDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.deckService.findMyDecks(searchDeckDto, user.id);
  }
  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  findById(
    @Param('id', new ParseMongoIdPipe()) id: string,
    @CurrentUser() user?: CurrentUserPayload,
  ) {
    return this.deckService.findById(id, user?.id);
  }
  @Put(':id/star')
  @UseGuards(JwtAuthGuard)
  star(
    @Param('id', new ParseMongoIdPipe()) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.deckService.starDeck(id, user.id);
  }
  @Delete(':id/star')
  @UseGuards(JwtAuthGuard)
  unstar(
    @Param('id', new ParseMongoIdPipe()) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.deckService.unstarDeck(id, user.id);
  }
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id', new ParseMongoIdPipe()) id: string,
    @Body() updateDeckDto: UpdateDeckDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.deckService.updateDeck(id, updateDeckDto, user.id);
  }
}
