import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Product, ProductImages } from './entities';
import { DataSource, Repository } from 'typeorm';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { validate as isUUID } from 'uuid';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger('ProductService');

  constructor(
    @InjectRepository(Product)
    private readonly ProductRepository: Repository<Product>,

    @InjectRepository(ProductImages)
    private readonly ProductImagesRepository: Repository<ProductImages>,

    private readonly dataSource: DataSource,
  ) {}

  async create(createProductDto: CreateProductDto) {
    try {
      const { images = [], ...productDetail } = createProductDto;

      const product = this.ProductRepository.create({
        ...productDetail,
        images: images.map((image) =>
          this.ProductImagesRepository.create({ url: image }),
        ),
      });

      await this.ProductRepository.save(product);
      return { ...product, images };
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }

  async findAll(paginationDto: PaginationDto) {
    const { offset = 0, limit = 1 } = paginationDto;

    const products = await this.ProductRepository.find({
      take: limit,
      skip: offset,
      relations: {
        images: true,
      },
    });

    return products.map((product) => ({
      ...product,
      images: product.images.map((img) => img.url),
    }));
  }

  async findOne(term: string) {
    let product: Product;
    if (isUUID(term)) {
      product = await this.ProductRepository.findOneBy({ id: term });
    } else {
      const queryBuilder = this.ProductRepository.createQueryBuilder('prod');
      product = await queryBuilder
        .where(`UPPER(title) = :title or slug =:slug `, {
          title: term.toUpperCase(),
          slug: term,
        })
        .leftJoinAndSelect('prod.images', 'prodImages')
        .getOne();
    }

    if (!product)
      throw new NotFoundException('Product does not exist in the BD');
    return product;
  }

  async findOnePlain(term: string) {
    const { images, ...rest } = await this.findOne(term);
    return {
      ...rest,
      images: images.map((img) => img.url),
    };
  }

  //TODO Update

  async update(id: string, updateProductDto: UpdateProductDto) {
    const { images, ...toUpdate } = updateProductDto;
    const product = await this.ProductRepository.preload({ id, ...toUpdate });

    if (!product) throw new NotFoundException('Product not found');

    //Create query runner
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      if (images) {
        await queryRunner.manager.delete(ProductImages, { product: { id } });
        product.images = images.map((image) =>
          this.ProductImagesRepository.create({ url: image }),
        );
      }
      await queryRunner.manager.save(product);
      await queryRunner.commitTransaction();
      await queryRunner.release();

      await this.ProductRepository.save(product);
      return this.findOnePlain(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.handleDBExceptions(error);
    }
  }

  async remove(id: string) {
    const product = await this.findOne(id);
    await this.ProductRepository.remove(product);
  }

  private handleDBExceptions(error: any) {
    if (error.code === '23505') throw new BadRequestException(error.detail);

    this.logger.error(error);
    throw new InternalServerErrorException(
      'Unexpected error, check server logs',
    );
  }

  deleteAllPoduct() {
    const query = this.ProductRepository.createQueryBuilder('products');
    try {
      return query.delete().where({}).execute();
    } catch (error) {
      this.handleDBExceptions(error);
    }
  }
}
