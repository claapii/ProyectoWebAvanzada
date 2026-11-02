import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../environments/environment';
import { HomePage } from './home.page';

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('should create', () => {
    http.expectOne(`${environment.apiUrl}/courses`).flush([]);
    expect(component).toBeTruthy();
  });

  it('muestra el total de asignaturas recibido del API', () => {
    http
      .expectOne(`${environment.apiUrl}/courses`)
      .flush([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(component.totalCursos()).toBe(3);
  });

  it('informa el error si el API falla', () => {
    http
      .expectOne(`${environment.apiUrl}/courses`)
      .flush({}, { status: 503, statusText: 'Service Unavailable' });
    expect(component.errorCursos()).toContain('no está disponible');
  });
});