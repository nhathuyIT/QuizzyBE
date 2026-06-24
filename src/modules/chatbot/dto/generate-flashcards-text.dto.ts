import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class GenerateFlashcardsTextDto {
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty({ message: 'Raw text is required' })
  @MaxLength(50000, { message: 'Raw text must be at most 50000 chars' })
  rawText!: string;

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
