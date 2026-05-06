import { IsString, IsBoolean, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateRegionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateRegionDto extends CreateRegionDto {}
