import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { ClearanceService } from '../api/services';
import { Business } from './business';

describe('Business', () => {
  it('creates a project and opens it', async () => {
    const createProject = vi.fn().mockReturnValue(of({ id: 5 }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ClearanceService, useValue: { listProjects: () => of([]), createProject } },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Business);
    const element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();

    const fill = (name: string, value: string) => {
      const input = element.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    fill('companyName', 'Muster Treuhand AG');
    fill('postcode', '8004');
    fill('locality', 'Zürich');
    fill('deadline', '2030-01-31');
    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();

    expect(createProject).toHaveBeenCalledWith({
      body: {
        companyName: 'Muster Treuhand AG',
        postcode: '8004',
        locality: 'Zürich',
        deadline: '2030-01-31',
      },
    });
    expect(navigate).toHaveBeenCalledWith(['/business', 5]);
  });
});
