import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { QuestionsService } from '../api/services';
import { Auth } from '../auth/auth';
import { ListingQuestions } from './listing-questions';

describe('ListingQuestions', () => {
  function setup(user: unknown, canAnswer: boolean) {
    const question = {
      id: 7,
      askerName: 'Buyer',
      text: 'Still there?',
      canAnswer,
      answer: null,
    };
    const api = {
      list1: vi.fn().mockReturnValue(of([question])),
      ask: vi.fn().mockReturnValue(of({ ...question, id: 8, text: 'New?' })),
      answer: vi.fn().mockReturnValue(of({ ...question, answer: 'Yes' })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: QuestionsService, useValue: api },
        { provide: Auth, useValue: { user: signal(user) } },
      ],
    });
    const fixture = TestBed.createComponent(ListingQuestions);
    fixture.componentRef.setInput('listingId', 3);
    return { api, fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('lists questions and lets a signed-in user ask', async () => {
    const { api, fixture, element } = setup({ id: 'u' }, false);
    await fixture.whenStable();
    expect(api.list1).toHaveBeenCalledWith({ listingId: 3 });
    expect(element.textContent).toContain('Buyer: Still there?');
    const input = element.querySelector<HTMLInputElement>('#question-text')!;
    input.value = 'New?';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
    expect(api.ask).toHaveBeenCalledWith({ listingId: 3, body: { text: 'New?' } });
    expect(element.querySelectorAll('[data-testid="question"]').length).toBe(2);
  });

  it('offers the answer field to the seller only and asks anonymous users to sign in', async () => {
    const seller = setup(null, true);
    await seller.fixture.whenStable();
    expect(seller.element.querySelector('#answer-7')).not.toBeNull();
    expect(seller.element.querySelector('#question-text')).toBeNull();
    expect(seller.element.querySelector('a[href="/login"]')).not.toBeNull();
  });
});
