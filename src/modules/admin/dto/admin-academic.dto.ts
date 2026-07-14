import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type {
  AcademicDocumentFileType,
  AcademicDocumentStatus,
} from '../../academic/schemas/academic-document.schema';
import { AdminPageOptionsDto } from './admin.dto';

const documentStatuses: AcademicDocumentStatus[] = [
  'pending',
  'active',
  'rejected',
  'archived',
];

const reviewStatuses: Exclude<AcademicDocumentStatus, 'archived'>[] = [
  'pending',
  'active',
  'rejected',
];

const fileTypes: AcademicDocumentFileType[] = [
  'pdf',
  'docx',
  'pptx',
  'xlsx',
  'other',
];

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class AdminAcademicDepartmentQueryDto extends AdminPageOptionsDto {
  @IsString()
  @IsOptional()
  keyword?: string;

  @IsIn(['active', 'inactive', 'all'])
  @IsOptional()
  status?: 'active' | 'inactive' | 'all';
}

export class CreateAdminDepartmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Transform(trimString)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Transform(trimString)
  name!: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  @Transform(trimString)
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateAdminDepartmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @IsOptional()
  @Transform(trimString)
  code?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @IsOptional()
  @Transform(trimString)
  name?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  @Transform(trimString)
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class AdminAcademicSubjectQueryDto extends AdminPageOptionsDto {
  @IsString()
  @IsOptional()
  keyword?: string;

  @IsMongoId()
  @IsOptional()
  departmentId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9)
  @IsOptional()
  semester?: number;

  @IsIn(['active', 'inactive', 'all'])
  @IsOptional()
  status?: 'active' | 'inactive' | 'all';
}

export class CreateAdminSubjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @Transform(trimString)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @Transform(trimString)
  name!: string;

  @IsMongoId()
  departmentId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9)
  semester!: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateAdminSubjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  @IsOptional()
  @Transform(trimString)
  code?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  @IsOptional()
  @Transform(trimString)
  name?: string;

  @IsMongoId()
  @IsOptional()
  departmentId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9)
  @IsOptional()
  semester?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class AdminAcademicDocumentQueryDto extends AdminPageOptionsDto {
  @IsString()
  @IsOptional()
  keyword?: string;

  @IsMongoId()
  @IsOptional()
  subjectId?: string;

  @IsMongoId()
  @IsOptional()
  departmentId?: string;

  @IsMongoId()
  @IsOptional()
  uploaderId?: string;

  @IsIn(fileTypes)
  @IsOptional()
  fileType?: AcademicDocumentFileType;

  @IsIn([...documentStatuses, 'all'])
  @IsOptional()
  status?: AcademicDocumentStatus | 'all';
}

export class UpdateAdminAcademicDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @IsOptional()
  @Transform(trimString)
  title?: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  @Transform(trimString)
  description?: string;

  @IsMongoId()
  @IsOptional()
  subjectId?: string;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value
          .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
          .filter(Boolean)
      : value,
  )
  tags?: string[];
}

export class ReviewAdminAcademicDocumentDto {
  @IsIn(reviewStatuses)
  status!: Exclude<AcademicDocumentStatus, 'archived'>;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  @Transform(trimString)
  note?: string;
}
