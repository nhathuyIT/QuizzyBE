import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class GenerateFlashcardsAcademicDocumentDto {
  @IsMongoId()
  documentId!: string;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  title?: string;

  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(30)
  @IsOptional()
  cardCount?: number;

  @IsEnum(['easy', 'medium', 'hard'])
  @IsOptional()
  difficulty?: 'easy' | 'medium' | 'hard';

  @IsString()
  @IsOptional()
  language?: string;

  @IsMongoId()
  @IsOptional()
  conversationId?: string;
}
