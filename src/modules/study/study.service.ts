import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateStudySessionDto } from './dto/create-study-session.dto';
import { LogCardReviewDto } from './dto/log-card-review.dto';
import { StudyRepository } from './study.repository';

@Injectable()
export class StudyService {
  constructor(private readonly studyRepository: StudyRepository) {}

  async createSession(
    createStudySessionDto: CreateStudySessionDto,
    userId: string,
  ) {
    return this.studyRepository.createSession(createStudySessionDto, userId);
  }

  async finishSession(sessionId: string) {
    const session = await this.studyRepository.finishSession(sessionId);
    if (!session) {
      throw new NotFoundException('Phiên học không tồn tại trên hệ thống');
    }

    return session;
  }

  async logReview(logCardReviewDto: LogCardReviewDto, userId: string) {
    const session = await this.studyRepository.findSessionById(
      logCardReviewDto.sessionId,
    );
    if (!session) {
      throw new NotFoundException('Phiên học không tồn tại trên hệ thống');
    }

    return this.studyRepository.logReview(logCardReviewDto, userId);
  }
}
