import {
  Body,
  Controller,
  Get,
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
import { StudySessionService } from './study-session.service';

@UseGuards(JwtAuthGuard)
@Controller('v1/study')
export class StudySessionController {
  constructor(private readonly studySessionService: StudySessionService) {}

  @Post('sessions')
  createSession(
    @Body() createStudySessionDto: CreateStudySessionDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.studySessionService.createSession(
      createStudySessionDto,
      userId,
    );
  }

  @Post('reviews')
  logReview(
    @Body() logCardReviewDto: LogCardReviewDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.studySessionService.logReview(logCardReviewDto, userId);
  }

  @Patch('sessions/:sessionId/finish')
  finishSession(
    @Param('sessionId', new ParseMongoIdPipe()) sessionId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.studySessionService.finishSession(sessionId, userId);
  }

  @Get('sessions')
  findSessions(@CurrentUser('id') userId: string) {
    return this.studySessionService.findSessions(userId);
  }

  @Get('sessions/:sessionId')
  findSession(
    @Param('sessionId', new ParseMongoIdPipe()) sessionId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.studySessionService.findSession(sessionId, userId);
  }
}
