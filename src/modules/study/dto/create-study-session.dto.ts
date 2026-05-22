import { IsEnum, IsMongoId, IsNotEmpty } from 'class-validator';

export class CreateStudySessionDto {
  @IsMongoId({ message: 'Mã bộ bài không hợp lệ' })
  @IsNotEmpty({ message: 'Mã bộ bài không được để trống' })
  deckId!: string;

  @IsEnum(['flashcard', 'learn', 'test', 'match'], {
    message: 'Chế độ học không hợp lệ',
  })
  @IsNotEmpty({ message: 'Chế độ học không được để trống' })
  mode!: string;
}
