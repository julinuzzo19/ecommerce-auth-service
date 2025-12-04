import { BadRequestException, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { CreateUserDto } from '@/services/dtos/user-create.dto';
import { GATEWAY_SECRET, GATEWAY_SERVICE } from '@/config/configs';
import { AxiosRequestConfig } from 'axios';

@Injectable()
export class UsersService {
  private readonly baseConfig: AxiosRequestConfig;

  constructor(private readonly httpService: HttpService) {
    this.baseConfig = {
      baseURL: GATEWAY_SERVICE,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'x-gateway-secret': GATEWAY_SECRET,
      },
    };
  }

  async create(data: CreateUserDto): Promise<any> {
    try {
      const response = await this.httpService.axiosRef.post(
        '/users',
        data,
        this.baseConfig,
      );
      return response.data;
    } catch (error) {
      console.log({ error });
      throw new BadRequestException();
    }
  }
  async findByEmail(email: string): Promise<any> {
    try {
      const response = await this.httpService.axiosRef.get(
        `/users/by-email?email=${email}`,
        this.baseConfig,
      );

      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return null;
      }
    }
  }
}
