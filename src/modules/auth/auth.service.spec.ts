import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  const userServiceMock = {
    createUser: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
  };
  const jwtServiceMock = {
    signAsync: jest.fn(),
  };
  const configServiceMock = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: userServiceMock,
        },
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('registers a user without issuing an access token', async () => {
    const userId = new Types.ObjectId();

    userServiceMock.findByEmail.mockResolvedValue(null);
    userServiceMock.createUser.mockResolvedValue({
      _id: userId,
      email: 'student@example.com',
      name: 'Student',
      role: 'student',
      avatarUrl: undefined,
      totalPoints: 0,
    });

    const result = await service.register({
      email: ' Student@Example.com ',
      password: 'password123',
      name: ' Student ',
    });

    expect(result).toEqual({
      id: userId.toString(),
      email: 'student@example.com',
      name: 'Student',
      role: 'student',
      avatarUrl: undefined,
      totalPoints: 0,
    });
    expect(result).not.toHaveProperty('accessToken');
    expect(jwtServiceMock.signAsync).not.toHaveBeenCalled();
    expect(userServiceMock.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'student@example.com',
        name: 'Student',
        role: 'student',
      }),
    );
  });
});
