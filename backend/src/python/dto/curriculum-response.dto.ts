import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Contrato de respuesta de POST /ingest/curriculum del servicio Python.
 * Se valida en NestJS aunque Python ya valide su salida: no se confía en datos
 * que llegan de otro servicio.
 */
export class CourseResponseDto {
  @IsString()
  @Length(2, 120)
  code: string;

  @IsString()
  @Length(2, 200)
  name: string;

  @IsInt()
  @Min(1)
  @Max(12)
  semester: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  category?: string | null;
}

export class ProvenanceResponseDto {
  @IsString()
  source_name: string;

  @IsString()
  source_url: string;

  @IsISO8601()
  fetched_at: string;

  @IsString()
  @Length(64, 64)
  sha256: string;

  @IsInt()
  @Min(0)
  content_length: number;

  @IsOptional()
  @IsString()
  resolution?: string | null;

  @IsBoolean()
  from_cache: boolean;

  @IsOptional()
  @IsBoolean()
  changed?: boolean | null;

  @IsString()
  extractor_version: string;
}

export class MetricsResponseDto {
  @IsInt()
  @Min(0)
  candidates: number;

  @IsInt()
  @Min(0)
  valid: number;

  @IsInt()
  @Min(0)
  rejected: number;

  @IsInt()
  @Min(0)
  duplicates: number;

  @IsInt()
  @Min(0)
  semesters_detected: number;

  @IsInt()
  @Min(0)
  semesters_expected: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  coverage: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  valid_ratio: number;

  @IsInt()
  @Min(0)
  duration_ms: number;
}

export class CurriculumResponseDto {
  @IsIn(['ok', 'degraded'])
  status: 'ok' | 'degraded';

  @ValidateNested()
  @Type(() => ProvenanceResponseDto)
  provenance: ProvenanceResponseDto;

  @ValidateNested()
  @Type(() => MetricsResponseDto)
  metrics: MetricsResponseDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CourseResponseDto)
  courses: CourseResponseDto[];

  @IsArray()
  @IsString({ each: true })
  warnings: string[];
}