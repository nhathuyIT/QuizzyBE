import { Controller, Get, Param, Query } from '@nestjs/common';
import { ParseMongoIdPipe } from '../../../common/pipes/parse-mongo-id.pipe';
import { QuerySubjectsDto } from '../dto/query-subjects.dto';
import { SubjectService } from '../services/subject.service';

@Controller('v1/academic/departments/:deptId/subjects')
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  @Get()
  findByDepartment(
    @Param('deptId', new ParseMongoIdPipe()) departmentId: string,
    @Query() query: QuerySubjectsDto,
  ) {
    return this.subjectService.findByDepartment(departmentId, query);
  }
}
