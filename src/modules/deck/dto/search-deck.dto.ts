import { PageOptionsDto } from '../../../common/dto/page-options.dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class SearchDeckDto extends PageOptionsDto {
  @IsString({ message: 'Từ khóa tìm kiếm phải là chuỗi ký tự' })
  @IsOptional()
  keyword?: string;

  @IsEnum(['private', 'link', 'public'], {
    message: 'Trạng thái hiển thị không hợp lệ',
  })
  @IsOptional()
  visibility?: string;
}
