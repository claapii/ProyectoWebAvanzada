export type Role = 'STUDENT' | 'ADMIN';

export interface User {
  id: number;
  email: string;
  role: Role;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
}

/** Fuente web de la que viene un dato (por ejemplo, la malla de la PUCV). */
export interface DataSourceInfo {
  key: string;
  name: string;
  url: string;
}

export interface Course {
  id: number;
  code: string;
  name: string;
  /** La fuente web no publica créditos: puede ser null. */
  credits: number | null;
  suggestedSemester: number;
  category: string | null;
  active: boolean;
  /** Fecha en que la asignatura se vio por última vez en la fuente. */
  lastSeenAt: string | null;
  source: DataSourceInfo | null;
}

export interface CourseFilters {
  semester?: number;
  category?: string;
  q?: string;
}

export type IngestionStatus = 'SUCCESS' | 'DEGRADED' | 'FAILED';

export interface IngestionProvenance {
  sourceName: string;
  sourceUrl: string;
  fetchedAt: string;
  sha256: string;
  contentLength: number;
  resolution: string;
  fromCache: boolean;
  changed: boolean | null;
  extractorVersion: string;
}

/** Métricas de calidad de los datos recuperados. */
export interface IngestionMetrics {
  candidates: number;
  valid: number;
  rejected: number;
  duplicates: number;
  semestersDetected: number;
  semestersExpected: number;
  coverage: number;
  validRatio: number;
}

export interface IngestionResult {
  runId: number;
  status: IngestionStatus;
  provenance: IngestionProvenance;
  metrics: IngestionMetrics;
  persistence: {
    created: number;
    updated: number;
    unchanged: number;
    deactivated: number;
  };
  warnings: string[];
}

/** Respuesta de error de la API; nunca trae trazas internas. */
export interface ApiError {
  statusCode: number;
  message: string | string[];
}