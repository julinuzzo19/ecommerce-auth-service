import { BadRequestException, Injectable } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { CreateUserDto } from "@/services/dtos/user-create.dto";
import { AxiosRequestConfig } from "axios";
import { UserByEmailResponseDto } from "@/services/dtos/user-email.dto";
import { EnvConfig } from "@/config/configs";

@Injectable()
export class UsersService {
  private readonly baseConfig: AxiosRequestConfig;

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService<EnvConfig>,
  ) {
    this.baseConfig = {
      baseURL: this.config.get("GATEWAY_SERVICE"),
      timeout: 5000,
      headers: {
        "Content-Type": "application/json",
        "x-gateway-secret": this.config.get("GATEWAY_SECRET"),
      },
    };
  }

  async create(data: CreateUserDto): Promise<string | null> {
    try {
      const response = await this.httpService.axiosRef.post("/users", data, this.baseConfig);
      return response.data?.userId;
    } catch (error) {
      throw new BadRequestException(error.response?.data || "Error creating user");
    }
  }

  async findByEmail(email: string): Promise<UserByEmailResponseDto | null> {
    try {
      const response = await this.httpService.axiosRef.get(`/users/by-email?email=${email}`, this.baseConfig);

      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return null;
      }
    }
  }

  async findById(userId: string): Promise<UserByEmailResponseDto | null> {
    try {
      const response = await this.httpService.axiosRef.get(`/users/${userId}`, this.baseConfig);
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return null;
      }
    }
  }
}
