import { Controller } from '@nestjs/common';
import { StudyService } from './study.service';

@Controller('v1/study')
export class StudyController {
  constructor(private readonly studyService: StudyService) {}
}
