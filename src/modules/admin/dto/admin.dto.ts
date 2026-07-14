import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RoleType } from '../../../common/enums/role-type.enum';

export class AdminPageOptionsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  take = 20;

  get skip() {
    return (this.page - 1) * this.take;
  }
}

export class AdminDateRangeDto {
  @IsDateString()
  @IsOptional()
  from?: string;

  @IsDateString()
  @IsOptional()
  to?: string;
}

export class AdminActivityQueryDto extends AdminDateRangeDto {
  @IsEnum(['day', 'week'])
  @IsOptional()
  interval: 'day' | 'week' = 'day';
}

export class AdminUserQueryDto extends AdminPageOptionsDto {
  @IsString()
  @IsOptional()
  keyword?: string;

  @IsEnum(RoleType)
  @IsOptional()
  role?: RoleType;

  @IsEnum(['active', 'suspended', 'deleted'])
  @IsOptional()
  status?: 'active' | 'suspended' | 'deleted';
}

export class UpdateAdminUserRoleDto {
  @IsEnum(RoleType)
  role!: RoleType;
}

export class UpdateAdminUserStatusDto {
  @IsEnum(['active', 'suspended'])
  status!: 'active' | 'suspended';

  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}

export class AdminDeckQueryDto extends AdminPageOptionsDto {
  @IsString()
  @IsOptional()
  keyword?: string;

  @IsEnum(['private', 'link', 'public'])
  @IsOptional()
  visibility?: 'private' | 'link' | 'public';

  @IsEnum(['active', 'hidden', 'deleted'])
  @IsOptional()
  moderationStatus?: 'active' | 'hidden' | 'deleted';

  @IsMongoId()
  @IsOptional()
  ownerId?: string;
}

export class AdminDeckDetailQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  cardPage = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  cardTake = 20;
}

export class CreateAdminDeckDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;

  @IsEnum(['private', 'link', 'public'])
  @IsOptional()
  visibility?: 'private' | 'link' | 'public';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsMongoId()
  ownerId!: string;
}

export class UpdateAdminDeckDto {
  @IsString()
  @MaxLength(200)
  @IsOptional()
  title?: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;

  @IsEnum(['private', 'link', 'public'])
  @IsOptional()
  visibility?: 'private' | 'link' | 'public';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsMongoId()
  @IsOptional()
  ownerId?: string;
}

export class ModerateDeckDto {
  @IsEnum(['active', 'hidden'])
  status!: 'active' | 'hidden';

  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}

export class AdminStudySessionQueryDto extends AdminPageOptionsDto {
  @IsMongoId()
  @IsOptional()
  userId?: string;

  @IsMongoId()
  @IsOptional()
  deckId?: string;

  @IsEnum(['flashcard', 'learn', 'test', 'match'])
  @IsOptional()
  mode?: 'flashcard' | 'learn' | 'test' | 'match';

  @IsEnum(['finished', 'unfinished'])
  @IsOptional()
  status?: 'finished' | 'unfinished';

  @IsDateString()
  @IsOptional()
  from?: string;

  @IsDateString()
  @IsOptional()
  to?: string;
}

export class AdminStudySummaryQueryDto extends AdminDateRangeDto {
  @IsEnum(['flashcard', 'learn', 'test', 'match'])
  @IsOptional()
  mode?: 'flashcard' | 'learn' | 'test' | 'match';
}

export class AdminAuditLogQueryDto extends AdminPageOptionsDto {
  @IsMongoId()
  @IsOptional()
  adminId?: string;

  @IsString()
  @IsOptional()
  action?: string;

  @IsDateString()
  @IsOptional()
  from?: string;

  @IsDateString()
  @IsOptional()
  to?: string;
}
