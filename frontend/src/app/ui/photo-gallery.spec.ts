import { TestBed } from '@angular/core/testing';
import { PhotoGallery } from './photo-gallery';

describe('PhotoGallery', () => {
  async function gallery(urls: string[]) {
    const fixture = TestBed.createComponent(PhotoGallery);
    fixture.componentRef.setInput('urls', urls);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const count = () => element.querySelector('.count')?.textContent?.trim();
    const click = async (selector: string) => {
      element.querySelector<HTMLButtonElement>(selector)!.click();
      await fixture.whenStable();
    };
    return { fixture, element, count, click };
  }

  it('shows a single photo without buttons', async () => {
    const { element } = await gallery(['/a.jpg']);
    expect(element.querySelectorAll('img').length).toBe(1);
    expect(element.querySelector('button')).toBeNull();
  });

  it('moves with the buttons and swipes, wraps at the ends and starts over for new photos', async () => {
    const { fixture, element, count, click } = await gallery(['/a.jpg', '/b.jpg', '/c.jpg']);
    expect(count()).toBe('1 / 3');

    await click('.next');
    expect(count()).toBe('2 / 3');
    expect(element.querySelector<HTMLElement>('.track')!.style.transform).toBe('translateX(-100%)');
    await click('.prev');
    await click('.prev');
    expect(count()).toBe('3 / 3');

    element.dispatchEvent(new MouseEvent('pointerdown', { clientX: 100 }));
    element.dispatchEvent(new MouseEvent('pointerup', { clientX: 300 })); // swipe right: back one
    await fixture.whenStable();
    expect(count()).toBe('2 / 3');
    element.dispatchEvent(new MouseEvent('pointerdown', { clientX: 100 }));
    element.dispatchEvent(new MouseEvent('pointerup', { clientX: 90 })); // a tap, not a swipe
    await fixture.whenStable();
    expect(count()).toBe('2 / 3');

    fixture.componentRef.setInput('urls', ['/d.jpg', '/e.jpg']);
    await fixture.whenStable();
    expect(count()).toBe('1 / 2');
  });
});
