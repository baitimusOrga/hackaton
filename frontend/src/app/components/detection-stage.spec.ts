import { TestBed } from '@angular/core/testing';
import { DetectionStage, StageMark } from './detection-stage';

describe('DetectionStage', () => {
  it('moves a label that would cover another one and leaves out one with no room', async () => {
    const box = [0.3, 0.4, 0.2, 0.2];
    const marks: StageMark[] = [
      { box, label: 'Marke: Trek', kind: 'detect' },
      { box, label: 'Federgabel', kind: 'detect' },
      { box, label: 'Rahmen', kind: 'detect' },
      { box, label: 'Kassette', kind: 'detect' },
    ];
    const fixture = TestBed.createComponent(DetectionStage);
    fixture.componentRef.setInput('src', 'blob:photo');
    fixture.componentRef.setInput('marks', marks);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('.mark').length).toBe(4); // every box stays
    expect(element.querySelector('.tag--above')!.textContent).toContain('Marke: Trek');
    expect(element.querySelector('.tag:not(.tag--above):not(.tag--inside)')!.textContent).toContain(
      'Federgabel',
    );
    expect(element.querySelector('.tag--inside')!.textContent).toContain('Rahmen');
    expect(element.textContent).not.toContain('Kassette');
  });
});
