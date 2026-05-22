import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class UpsertCardProgressDto {
  @IsMongoId({ message: 'Mã thẻ không hợp lệ' })
  @IsNotEmpty({ message: 'Mã thẻ không được để trống' })
  cardId!: string;

  @IsMongoId({ message: 'Mã bộ bài không hợp lệ' })
  @IsNotEmpty({ message: 'Mã bộ bài không được để trống' })
  deckId!: string;

  @IsInt({ message: 'Mức độ thành thạo phải là số nguyên' })
  @Min(0, { message: 'Mức độ thành thạo tối thiểu là 0' })
  @Max(100, { message: 'Mức độ thành thạo tối đa là 100' })
  @IsOptional()
  mastery?: number;

  @IsEnum(['new', 'learning', 'review', 'mastered'], {
    message: 'Trạng thái học tập không hợp lệ',
  })
  @IsOptional()
  status?: string;

  @IsNumber({}, { message: 'Hệ số độ dễ phải là một số' })
  @IsOptional()
  easeFactor?: number;

  @IsInt({ message: 'Khoảng cách ôn tập phải là số nguyên' })
  @Min(0, { message: 'Khoảng cách ôn tập không được âm' })
  @IsOptional()
  intervalDays?: number;

  @Type(() => Date)
  @IsDate({ message: 'Ngày ôn tập tiếp theo không hợp lệ' })
  @IsNotEmpty({ message: 'Ngày ôn tập tiếp theo không được để trống' })
  dueAt!: Date;

  @IsInt({ message: 'Số lần đúng phải là số nguyên' })
  @Min(0, { message: 'Số lần đúng không được âm' })
  @IsOptional()
  correctCount?: number;

  @IsInt({ message: 'Số lần sai phải là số nguyên' })
  @Min(0, { message: 'Số lần sai không được âm' })
  @IsOptional()
  wrongCount?: number;
}
