import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SearchDeckDto {
  @IsString({ message: 'Từ khóa tìm kiếm phải là chuỗi ký tự' })
  @IsOptional()
  keyword?: string;

  @IsEnum(['private', 'link', 'public'], {
    message: 'Trạng thái hiển thị không hợp lệ',
  })
  @IsOptional()
  visibility?: string;

  @IsInt({ message: 'Số trang phải là số nguyên' })
  @Min(1, { message: 'Số trang phải lớn hơn hoặc bằng 1' })
  @IsOptional()
  page?: number;

  @IsInt({ message: 'Số lượng bản ghi phải là số nguyên' })
  @Min(1, { message: 'Số lượng bản ghi phải lớn hơn hoặc bằng 1' })
  @Max(100, { message: 'Số lượng bản ghi tối đa là 100' })
  @IsOptional()
  limit?: number;
}
