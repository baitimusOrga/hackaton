import { Pipe, PipeTransform } from '@angular/core';

/** Swiss price format: `CHF 1’250.–` for whole francs, `CHF 12.50` with rappen. */
export function chf(amount: number): string {
  const whole = Math.floor(amount);
  const rappen = Math.round((amount - whole) * 100);
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '’');
  return `CHF ${grouped}${rappen ? `.${String(rappen).padStart(2, '0')}` : '.–'}`;
}

@Pipe({ name: 'chf' })
export class ChfPipe implements PipeTransform {
  transform(amount: number): string {
    return chf(amount);
  }
}
