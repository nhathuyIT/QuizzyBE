import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleType } from '../../common/enums/role-type.enum';
import { JwtAuthGuard } from '../../common/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe';
import { AdminService } from './admin.service';
import {
  AdminAcademicDepartmentQueryDto,
  AdminAcademicDocumentQueryDto,
  AdminAcademicSubjectQueryDto,
  CreateAdminDepartmentDto,
  CreateAdminSubjectDto,
  ReviewAdminAcademicDocumentDto,
  UpdateAdminAcademicDocumentDto,
  UpdateAdminDepartmentDto,
  UpdateAdminSubjectDto,
} from './dto/admin-academic.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.ADMIN)
@Controller('v1/admin/academic')
export class AdminAcademicController {
  constructor(private readonly adminService: AdminService) {}

  @Get('departments')
  findDepartments(@Query() query: AdminAcademicDepartmentQueryDto) {
    return this.adminService.findAcademicDepartments(query);
  }

  @Post('departments')
  createDepartment(
    @Body() dto: CreateAdminDepartmentDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.createAcademicDepartment(dto, adminId);
  }

  @Patch('departments/:departmentId')
  updateDepartment(
    @Param('departmentId', new ParseMongoIdPipe()) departmentId: string,
    @Body() dto: UpdateAdminDepartmentDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.updateAcademicDepartment(
      departmentId,
      dto,
      adminId,
    );
  }

  @Delete('departments/:departmentId')
  deleteDepartment(
    @Param('departmentId', new ParseMongoIdPipe()) departmentId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.deleteAcademicDepartment(departmentId, adminId);
  }

  @Post('departments/:departmentId/restore')
  @HttpCode(HttpStatus.OK)
  restoreDepartment(
    @Param('departmentId', new ParseMongoIdPipe()) departmentId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.restoreAcademicDepartment(departmentId, adminId);
  }

  @Get('subjects')
  findSubjects(@Query() query: AdminAcademicSubjectQueryDto) {
    return this.adminService.findAcademicSubjects(query);
  }

  @Post('subjects')
  createSubject(
    @Body() dto: CreateAdminSubjectDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.createAcademicSubject(dto, adminId);
  }

  @Patch('subjects/:subjectId')
  updateSubject(
    @Param('subjectId', new ParseMongoIdPipe()) subjectId: string,
    @Body() dto: UpdateAdminSubjectDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.updateAcademicSubject(subjectId, dto, adminId);
  }

  @Delete('subjects/:subjectId')
  deleteSubject(
    @Param('subjectId', new ParseMongoIdPipe()) subjectId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.deleteAcademicSubject(subjectId, adminId);
  }

  @Post('subjects/:subjectId/restore')
  @HttpCode(HttpStatus.OK)
  restoreSubject(
    @Param('subjectId', new ParseMongoIdPipe()) subjectId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.restoreAcademicSubject(subjectId, adminId);
  }

  @Get('documents')
  findDocuments(@Query() query: AdminAcademicDocumentQueryDto) {
    return this.adminService.findAcademicDocuments(query);
  }

  @Get('documents/:documentId')
  findDocument(
    @Param('documentId', new ParseMongoIdPipe()) documentId: string,
  ) {
    return this.adminService.findAcademicDocument(documentId);
  }

  @Patch('documents/:documentId')
  updateDocument(
    @Param('documentId', new ParseMongoIdPipe()) documentId: string,
    @Body() dto: UpdateAdminAcademicDocumentDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.updateAcademicDocument(documentId, dto, adminId);
  }

  @Patch('documents/:documentId/review')
  reviewDocument(
    @Param('documentId', new ParseMongoIdPipe()) documentId: string,
    @Body() dto: ReviewAdminAcademicDocumentDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.reviewAcademicDocument(documentId, dto, adminId);
  }

  @Delete('documents/:documentId')
  deleteDocument(
    @Param('documentId', new ParseMongoIdPipe()) documentId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.deleteAcademicDocument(documentId, adminId);
  }

  @Post('documents/:documentId/restore')
  @HttpCode(HttpStatus.OK)
  restoreDocument(
    @Param('documentId', new ParseMongoIdPipe()) documentId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.restoreAcademicDocument(documentId, adminId);
  }
}
