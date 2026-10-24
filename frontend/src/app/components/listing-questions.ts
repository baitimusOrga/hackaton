import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { QuestionView } from '../api/models';

// the generated model marks every field optional; the API always sends them
type Question = Required<QuestionView>;
import { QuestionsService } from '../api/services';
import { Auth } from '../auth/auth';
import { TranslatePipe } from '../i18n/i18n';
import { Button } from '../ui/button';

/** Public questions of a listing: signed-in users ask, the seller answers. */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-listing-questions',
  imports: [Button, FormsModule, RouterLink, TranslatePipe],
  template: `
    @for (q of questions(); track q.id) {
      <div class="q" data-testid="question">
        <p>
          <strong>{{ q.askerName }}:</strong> {{ q.text }}
        </p>
        @if (q.answer) {
          <p class="a">
            <strong>{{ 'Verkäufer' | t }}:</strong> {{ q.answer }}
          </p>
        }
        @if (q.canAnswer) {
          <form class="row" (ngSubmit)="answer(q)">
            <label class="zw-sr-only" [for]="'answer-' + q.id">{{ 'Antwort' | t }}</label>
            <input
              class="zw-input"
              [id]="'answer-' + q.id"
              [name]="'answer-' + q.id"
              maxlength="1000"
              [ngModel]="answers()[q.id] ?? q.answer ?? ''"
              (ngModelChange)="setAnswer(q.id, $event)"
            />
            <button appButton type="submit" size="sm" [disabled]="!(answers()[q.id] ?? '').trim()">
              {{ 'Antworten' | t }}
            </button>
          </form>
        }
      </div>
    } @empty {
      <p class="zw-muted">{{ 'Noch keine Fragen.' | t }}</p>
    }
    @if (auth.user()) {
      <form class="row" (ngSubmit)="ask()">
        <label class="zw-sr-only" for="question-text">{{ 'Frage stellen' | t }}</label>
        <input
          #field
          id="question-text"
          name="text"
          class="zw-input"
          maxlength="1000"
          [placeholder]="'Frage stellen' | t"
          [(ngModel)]="text"
        />
        <button appButton type="submit" [disabled]="!text().trim()">{{ 'Senden' | t }}</button>
      </form>
    } @else {
      <a routerLink="/login" class="zw-link">{{ 'Zum Fragen anmelden' | t }}</a>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .q {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }
    .a {
      padding-left: var(--space-4);
    }
    .row {
      display: flex;
      gap: var(--space-2);
    }
    .row .zw-input {
      flex: 1;
    }
  `,
})
export class ListingQuestions implements OnInit {
  readonly listingId = input.required<number>();
  protected readonly auth = inject(Auth);
  private readonly api = inject(QuestionsService);
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');
  protected readonly questions = signal<Question[]>([]);
  protected readonly text = signal('');
  protected readonly answers = signal<Record<number, string>>({});

  ngOnInit(): void {
    // list1 is the generated name of GET /api/listings/{id}/questions
    this.api
      .list1({ listingId: this.listingId() })
      .subscribe((list) => this.questions.set(list as Question[]));
  }

  /** Called by the "Frage stellen" link next to the buy button. */
  focus(): void {
    const field = this.field()?.nativeElement;
    field?.scrollIntoView({ block: 'center' });
    field?.focus();
  }

  protected setAnswer(id: number, value: string): void {
    this.answers.update((all) => ({ ...all, [id]: value }));
  }

  protected ask(): void {
    this.api
      .ask({ listingId: this.listingId(), body: { text: this.text() } })
      .subscribe((created) => {
        this.questions.update((list) => [...list, created as Question]);
        this.text.set('');
      });
  }

  protected answer(q: Question): void {
    this.api
      .answer({
        listingId: this.listingId(),
        questionId: q.id,
        body: { answer: this.answers()[q.id] ?? '' },
      })
      .subscribe((updated) => {
        this.questions.update((list) =>
          list.map((x) => (x.id === updated.id ? (updated as Question) : x)),
        );
        this.setAnswer(q.id, '');
      });
  }
}
