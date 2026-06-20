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
  AdminActivityQueryDto,
  AdminAuditLogQueryDto,
  AdminDateRangeDto,
  AdminDeckDetailQueryDto,
  AdminDeckQueryDto,
  AdminPageOptionsDto,
  AdminStudySessionQueryDto,
  AdminStudySummaryQueryDto,
  AdminUserQueryDto,
  ModerateDeckDto,
  UpdateAdminUserRoleDto,
  UpdateAdminUserStatusDto,
} from './dto/admin.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.ADMIN)
@Controller('v1/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard/summary')
  getDashboardSummary(@Query() query: AdminDateRangeDto) {
    return this.adminService.getDashboardSummary(query);
  }

  @Get('analytics/activity')
  getActivity(@Query() query: AdminActivityQueryDto) {
    return this.adminService.getActivity(query);
  }

  @Get('users')
  findUsers(@Query() query: AdminUserQueryDto) {
    return this.adminService.findUsers(query);
  }

  @Get('users/:userId')
  findUser(@Param('userId', new ParseMongoIdPipe()) userId: string) {
    return this.adminService.findUser(userId);
  }

  @Patch('users/:userId/role')
  updateUserRole(
    @Param('userId', new ParseMongoIdPipe()) userId: string,
    @Body() dto: UpdateAdminUserRoleDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.updateUserRole(userId, dto, adminId);
  }

  @Patch('users/:userId/status')
  updateUserStatus(
    @Param('userId', new ParseMongoIdPipe()) userId: string,
    @Body() dto: UpdateAdminUserStatusDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.updateUserStatus(userId, dto, adminId);
  }

  @Post('users/:userId/revoke-sessions')
  @HttpCode(HttpStatus.OK)
  revokeUserSessions(
    @Param('userId', new ParseMongoIdPipe()) userId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.revokeUserSessions(userId, adminId);
  }

  @Delete('users/:userId')
  deleteUser(
    @Param('userId', new ParseMongoIdPipe()) userId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.deleteUser(userId, adminId);
  }

  @Post('users/:userId/restore')
  @HttpCode(HttpStatus.OK)
  restoreUser(
    @Param('userId', new ParseMongoIdPipe()) userId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.restoreUser(userId, adminId);
  }

  @Get('decks')
  findDecks(@Query() query: AdminDeckQueryDto) {
    return this.adminService.findDecks(query);
  }

  @Get('decks/:deckId')
  findDeck(
    @Param('deckId', new ParseMongoIdPipe()) deckId: string,
    @Query() query: AdminDeckDetailQueryDto,
  ) {
    return this.adminService.findDeck(deckId, query);
  }

  @Patch('decks/:deckId/moderation')
  moderateDeck(
    @Param('deckId', new ParseMongoIdPipe()) deckId: string,
    @Body() dto: ModerateDeckDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.moderateDeck(deckId, dto, adminId);
  }

  @Delete('decks/:deckId')
  deleteDeck(
    @Param('deckId', new ParseMongoIdPipe()) deckId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.deleteDeck(deckId, adminId);
  }

  @Post('decks/:deckId/restore')
  @HttpCode(HttpStatus.OK)
  restoreDeck(
    @Param('deckId', new ParseMongoIdPipe()) deckId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.restoreDeck(deckId, adminId);
  }

  @Get('study/summary')
  getStudySummary(@Query() query: AdminStudySummaryQueryDto) {
    return this.adminService.getStudySummary(query);
  }

  @Get('study-sessions')
  findStudySessions(@Query() query: AdminStudySessionQueryDto) {
    return this.adminService.findStudySessions(query);
  }

  @Get('study-sessions/:sessionId/reviews')
  findSessionReviews(
    @Param('sessionId', new ParseMongoIdPipe()) sessionId: string,
    @Query() query: AdminPageOptionsDto,
  ) {
    return this.adminService.findSessionReviews(
      sessionId,
      query.page,
      query.take,
    );
  }

  @Get('study-sessions/:sessionId')
  findStudySession(
    @Param('sessionId', new ParseMongoIdPipe()) sessionId: string,
  ) {
    return this.adminService.findStudySession(sessionId);
  }

  @Get('audit-logs')
  findAuditLogs(@Query() query: AdminAuditLogQueryDto) {
    return this.adminService.findAuditLogs(query);
  }
}
