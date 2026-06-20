import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { User } from './schemas/user.schema';
import { UserRepository } from './user.repository';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async createUser(data: Partial<User>) {
    return this.userRepository.create(data);
  }

  async findByEmail(email: string) {
    return this.userRepository.findByEmail(email);
  }

  async findById(id: string) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại trên hệ thống');
    }

    return user;
  }

  findByIdForAuth(id: string) {
    return this.userRepository.findByIdForAuth(id);
  }

  async updateProfile(id: string, updateUserProfileDto: UpdateUserProfileDto) {
    const user = await this.userRepository.updateProfile(
      id,
      updateUserProfileDto,
    );
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại trên hệ thống');
    }

    return user;
  }

  async invalidateTokens(id: string) {
    const user = await this.userRepository.incrementTokenVersion(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async markLogin(id: string) {
    const user = await this.userRepository.updateLastLogin(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
