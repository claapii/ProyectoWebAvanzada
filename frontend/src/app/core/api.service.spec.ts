import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../environments/environment';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let api: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide los cursos sin filtros', () => {
    api.getCourses().subscribe();
    const req = http.expectOne(`${environment.apiUrl}/courses`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush([]);
  });

  it('envía los filtros como parámetros', () => {
    api.getCourses({ semester: 3, q: ' calculo ' }).subscribe();
    const req = http.expectOne(
      (r) => r.url === `${environment.apiUrl}/courses`,
    );
    expect(req.request.params.get('semester')).toBe('3');
    expect(req.request.params.get('q')).toBe('calculo');
    req.flush([]);
  });

  it('dispara la ingesta con POST', () => {
    api.runCurriculumIngestion().subscribe();
    const req = http.expectOne(`${environment.apiUrl}/ingestion/curriculum`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('pide el historial de ejecuciones con límite', () => {
    api.getIngestionRuns(5).subscribe();
    const req = http.expectOne(
      (r) => r.url === `${environment.apiUrl}/ingestion/runs`,
    );
    expect(req.request.params.get('limit')).toBe('5');
    req.flush([]);
  });
});