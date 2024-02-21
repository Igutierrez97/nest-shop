import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto, LoginUserDto } from './dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userrepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}
  async create(createUserDto: CreateUserDto) {
    try {
      const { password, ...userData } = createUserDto;
      const user = this.userrepository.create({
        ...userData,
        password: bcrypt.hashSync(password, 10),
      });
      await this.userrepository.save(user);
      delete user.password;
      return {
        ...user,
        token: this.getJwtToken({ email: user.email }),
      };
    } catch (error) {
      this.hadleDbError(error);
    }
  }

  async login(loginUserDto: LoginUserDto) {
    const { email, password } = loginUserDto;
    const user = await this.userrepository.findOne({
      where: { email },
      select: { email: true, password: true },
    });
    console.log(user);
    if (!user) throw new UnauthorizedException('Not Valid Credentials');
    if (!bcrypt.compare(password, user.password))
      throw new UnauthorizedException('Not Valid Credentials (password)');

    return {
      ...user,
      token: this.getJwtToken({ email: user.email }),
    };
  }

  private getJwtToken(payload: JwtPayload) {
    const token = this.jwtService.sign(payload);
    return token;
  }

  private hadleDbError(error: any): never {
    if (error.code === '23505') throw new BadRequestException(error.detail);
    console.log(error);
    throw new InternalServerErrorException(`Please check logs ${error.code}`);
  }
}
