import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../i18n/i18n';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  selector: 'app-about',
  template: `<h1>About Us</h1>
    <p>
      We are four software development apprentices in our third year of training. We met at school
      and work at four different companies.
    </p>
    <p>
      Together, we decided to participate in Zentral Hack in the <em>Young Talents</em> category.
      Our goal is to develop an online marketplace.
    </p>
    <p>
      Although we come from different companies, we share a passion for software development and
      enjoy working on new challenges.
    </p>
    <p>
      With this project, we want to improve our programming skills, gain practical experience and
      create something useful together.
    </p>`,
  styles: 'h1, p { margin-bottom: var(--space-4); }',
})
export class About {}
