import { Controller, Get } from '@nestjs/common';
import { DepartmentService } from '../services/department.service';

@Controller('v1/academic/departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  findAll() {
    return this.departmentService.findAll();
  }
}
