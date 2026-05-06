import { IsString, IsInt, IsOptional, IsNotEmpty, Min, Max } from 'class-validator';
import { NodeStatus } from '@proxy-manager/db';

export class CreateNodeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  host?: string;

  @IsString()
  @IsNotEmpty()
  ipAddress: string;

  @IsString()
  @IsOptional()
  regionId?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(65535)
  sshPort?: number;

  @IsString()
  @IsOptional()
  sshUsername?: string;

  @IsString()
  @IsOptional()
  sshPassword?: string;

  @IsString()
  @IsOptional()
  sshPrivateKey?: string;

  @IsString()
  @IsOptional()
  sshKeyPassphrase?: string;

  @IsInt()
  @IsOptional()
  proxyPortStart?: number;

  @IsInt()
  @IsOptional()
  proxyPortEnd?: number;

  @IsInt()
  @IsOptional()
  maxPorts?: number;

  @IsString()
  @IsOptional()
  ipv6Subnet?: string;
}

export class UpdateNodeDto extends CreateNodeDto {
  @IsString()
  @IsOptional()
  status?: NodeStatus;
}
