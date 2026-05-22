import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateDeckDto {
  @IsString({ message: 'Tiêu đề bộ bài phải là một chuỗi ký tự' })
  @IsOptional()
  title?: string;

  @IsString({ message: 'Mô tả bộ bài phải là một chuỗi ký tự' })
  @IsOptional()
  description?: string;

  @IsEnum(['private', 'link', 'public'], {
    message: 'Trạng thái hiển thị không hợp lệ',
  })
  @IsOptional()
  visibility?: string;

  @IsArray({ message: 'Danh sách nhãn tags phải là một mảng' })
  @IsString({ each: true, message: 'Mỗi thẻ tag phải là định dạng chữ' })
  @IsOptional()
  tags?: string[];
}
