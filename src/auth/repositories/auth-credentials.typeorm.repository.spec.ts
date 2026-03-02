import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TypeOrmAuthCredentialsRepository } from './auth-credentials.typeorm.repository';
import { AuthCredentials } from '@/auth/auth-credentials.entity';

type MockRepository = jest.Mocked<Pick<Repository<AuthCredentials>, 'findOne' | 'create' | 'save'>>;

const createMockRepo = (): MockRepository => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

describe('TypeOrmAuthCredentialsRepository', () => {
  let repository: TypeOrmAuthCredentialsRepository;
  let typeormRepo: MockRepository;

  beforeEach(async () => {
    typeormRepo = createMockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TypeOrmAuthCredentialsRepository,
        {
          provide: getRepositoryToken(AuthCredentials),
          useValue: typeormRepo,
        },
      ],
    }).compile();

    repository = module.get<TypeOrmAuthCredentialsRepository>(TypeOrmAuthCredentialsRepository);
  });

  afterEach(() => jest.clearAllMocks());

  describe('findPasswordByUserId', () => {
    it('retorna el password hasheado cuando el usuario existe', async () => {
      const hashedPassword = 'salt:hash';
      typeormRepo.findOne.mockResolvedValue({ password: hashedPassword } as AuthCredentials);

      const result = await repository.findPasswordByUserId('user-uuid');

      expect(result).toBe(hashedPassword);
      expect(typeormRepo.findOne).toHaveBeenCalledWith({
        select: ['password'],
        where: { userId: 'user-uuid' },
      });
    });

    it('retorna null cuando no existen credenciales para el userId', async () => {
      typeormRepo.findOne.mockResolvedValue(null);

      const result = await repository.findPasswordByUserId('nonexistent-uuid');

      expect(result).toBeNull();
    });
  });

  describe('saveCredentials', () => {
    it('crea y guarda las credenciales correctamente', async () => {
      const credEntity = { userId: 'user-uuid', password: 'salt:hash' } as AuthCredentials;
      typeormRepo.create.mockReturnValue(credEntity);
      typeormRepo.save.mockResolvedValue(credEntity);

      await repository.saveCredentials('user-uuid', 'salt:hash');

      expect(typeormRepo.create).toHaveBeenCalledWith({ userId: 'user-uuid', password: 'salt:hash' });
      expect(typeormRepo.save).toHaveBeenCalledWith(credEntity);
    });

    it('no lanza cuando save es exitoso', async () => {
      typeormRepo.create.mockReturnValue({} as AuthCredentials);
      typeormRepo.save.mockResolvedValue({} as AuthCredentials);

      await expect(repository.saveCredentials('user-uuid', 'salt:hash')).resolves.toBeUndefined();
    });
  });
});
