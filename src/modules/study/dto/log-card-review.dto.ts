import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class LogCardReviewDto {
  @IsString({ message: 'Answer must be a string' })
  @IsOptional()
  answer?: string;

  @IsBoolean({ message: 'isCorrect must be a boolean' })
  @IsNotEmpty({ message: 'isCorrect is required' })
  isCorrect!: boolean;

  @IsEnum(['again', 'hard', 'good', 'easy'], {
    message: 'rating must be one of again, hard, good, easy',
  })
  @IsNotEmpty({ message: 'rating is required' })
  rating!: 'again' | 'hard' | 'good' | 'easy';

  @IsInt({ message: 'responseTimeMs must be an integer' })
  @IsOptional()
  responseTimeMs?: number;
}
