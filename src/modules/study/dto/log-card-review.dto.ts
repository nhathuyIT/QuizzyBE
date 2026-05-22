import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class LogCardReviewDto {
  @IsMongoId({ message: 'Mã phiên học không hợp lệ' })
  @IsNotEmpty({ message: 'Mã phiên học không được để trống' })
  sessionId: string;

  @IsMongoId({ message: 'Mã thẻ không hợp lệ' })
  @IsNotEmpty({ message: 'Mã thẻ không được để trống' })
  cardId: string;

  @IsString({ message: 'Câu trả lời phải là chuỗi ký tự' })
  @IsOptional()
  answer?: string;

  @IsBoolean({ message: 'Kết quả đúng sai phải là giá trị boolean' })
  @IsNotEmpty({ message: 'Kết quả đúng sai không được để trống' })
  isCorrect: boolean;

  @IsEnum(['again', 'hard', 'good', 'easy'], {
    message: 'Mức đánh giá ôn tập không hợp lệ',
  })
  @IsNotEmpty({ message: 'Mức đánh giá không được để trống' })
  rating: string;

  @IsInt({ message: 'Thời gian phản hồi phải là số nguyên' })
  @IsNotEmpty({ message: 'Thời gian phản hồi không được để trống' })
  responseTimeMs: number;
}
