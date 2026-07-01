import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { AcademicDocumentFileType } from '../schemas/academic-document.schema';

const fileTypes: AcademicDocumentFileType[] = [
  'pdf',
  'docx',
  'pptx',
  'xlsx',
  'other',
];

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title!: string;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @IsMongoId()
  subjectId!: string;

  @IsUrl({ require_protocol: true })
  @MaxLength(3000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  fileUrl!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  fileName!: string;

  @IsIn(fileTypes)
  fileType!: AcademicDocumentFileType;

  @Type(() => Number)
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(1024 * 1024 * 1024)
  fileSize!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  storagePath!: string;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
          .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
          .filter(Boolean)
      : value,
  )
  tags?: string[];
}
