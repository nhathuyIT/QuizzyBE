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

export class GenerateFlashcardsPdfDto {
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(200)
  title!: string;

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
