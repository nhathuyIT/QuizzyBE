import {
  IsArray,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateCardDto {
  @IsMongoId({ message: 'Mã bộ bài không hợp lệ' })
  @IsNotEmpty({ message: 'Mã bộ bài không được để trống' })
  deckId: string;

  @IsString({ message: 'Nội dung mặt trước phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Nội dung mặt trước không được bỏ trống' })
  front: string;

  @IsString({ message: 'Nội dung mặt sau phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Nội dung mặt sau không được bỏ trống' })
  back: string;

  @IsString({ message: 'Gợi ý phải là chuỗi ký tự' })
  @IsOptional()
  hint?: string;

  @IsString({ message: 'Giải thích phải là chuỗi ký tự' })
  @IsOptional()
  explanation?: string;

  @IsString({ message: 'Đường dẫn hình ảnh phải là chuỗi ký tự' })
  @IsOptional()
  imageUrl?: string;

  @IsArray({ message: 'Danh sách ví dụ phải là một mảng' })
  @IsString({ each: true, message: 'Mỗi ví dụ phải là chuỗi ký tự' })
  @IsOptional()
  examples?: string[];

  @IsInt({ message: 'Vị trí thẻ phải là số nguyên' })
  @Min(0, { message: 'Vị trí thẻ phải lớn hơn hoặc bằng 0' })
  @IsNotEmpty({ message: 'Vị trí thẻ không được để trống' })
  position: number;
}
