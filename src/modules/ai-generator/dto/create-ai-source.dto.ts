import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateAiSourceAndJobDto {
  @IsEnum(['text', 'pdf', 'url', 'image'], {
    message: 'Loại nguồn học liệu không hợp lệ',
  })
  @IsNotEmpty({ message: 'Loại nguồn học liệu không được để trống' })
  type: string;

  @IsString({ message: 'Tiêu đề tài liệu phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tiêu đề tài liệu không được để trống' })
  title: string;

  @IsString({ message: 'Nội dung văn bản phải là chuỗi ký tự' })
  @IsOptional()
  rawText?: string;

  @IsString({ message: 'Đường dẫn file phải là chuỗi ký tự' })
  @IsOptional()
  fileUrl?: string;

  @IsInt({ message: 'Số lượng thẻ phải là số nguyên' })
  @Min(5, { message: 'Số lượng thẻ tối thiểu là 5' })
  @Max(30, { message: 'Số lượng thẻ tối đa là 30' })
  @IsOptional()
  cardCount?: number;

  @IsEnum(['easy', 'medium', 'hard'], {
    message: 'Độ khó không hợp lệ',
  })
  @IsOptional()
  difficulty?: string;

  @IsString({ message: 'Ngôn ngữ phải là chuỗi ký tự' })
  @IsOptional()
  language?: string;
}
