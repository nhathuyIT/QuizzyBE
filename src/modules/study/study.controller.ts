import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe';
import { CreateStudySessionDto } from './dto/create-study-session.dto';
import { LogCardReviewDto } from './dto/log-card-review.dto';
import { StudyService } from './study.service';

@UseGuards(JwtAuthGuard)
@Controller('v1/study')
export class StudyController {
  constructor(private readonly studyService: StudyService) {}

  @Post('sessions')
  createSession(
    @Body() createStudySessionDto: CreateStudySessionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.studyService.createSession(createStudySessionDto, userId);
  }

  @Post('reviews')
  @HttpCode(HttpStatus.OK)
  logReview(
    @Body() logCardReviewDto: LogCardReviewDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.studyService.logReview(logCardReviewDto, userId);
  }

  @Patch('sessions/:sessionId/finish')
  finishSession(
    @Param('sessionId', new ParseMongoIdPipe()) sessionId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.studyService.finishSession(sessionId, userId);
  }

  @Get('sessions')
  findSessions(@CurrentUser('id') userId: string) {
    return this.studyService.findSessions(userId);
  }

  @Get('sessions/:sessionId')
  findSession(
    @Param('sessionId', new ParseMongoIdPipe()) sessionId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.studyService.findSession(sessionId, userId);
  }
}
