import { IsInt, IsString, IsOptional, IsNotEmpty, ValidateNested, IsArray } from 'class-validator';

export class CreateProxyDto {
  @IsInt()
  @IsNotEmpty()
  userId: number;

  @IsInt()
  @IsOptional()
  nodeId?: number;

  @IsString()
  @IsNotEmpty()
  expiresAt: string;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}

export class TrafficRecordDto {
  @IsInt()
  @IsNotEmpty()
  proxyId: number;

  @IsInt()
  @IsNotEmpty()
  bytesIn: number;

  @IsInt()
  @IsNotEmpty()
  bytesOut: number;

  @IsString()
  @IsNotEmpty()
  recordedAt: string;
}

export class TrafficBatchDto {
  @IsInt()
  @IsNotEmpty()
  nodeId: number;

  @IsArray()
  @IsNotEmpty()
  records: any[];
}
export class CreateBulkProxyDto {
  @IsInt()
  @IsNotEmpty()
  userId: number;

  @IsInt()
  @IsOptional()
  nodeId?: number;

  @IsString()
  @IsNotEmpty()
  expiresAt: string;

  @IsInt()
  @IsNotEmpty()
  count: number;
}

export class DeleteBulkProxyDto {
  @IsArray()
  @IsNotEmpty()
  ids: number[];
}
