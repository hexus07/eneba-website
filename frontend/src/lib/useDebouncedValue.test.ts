import { act, renderHook } from '@testing-library/react';
import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('updates only after the value has been stable for the delay', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 200), { initialProps: { v: 'e' } });
    expect(result.current).toBe('e');

    rerender({ v: 'el' });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    rerender({ v: 'eld' }); // restarts the timer
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe('e');

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe('eld');
  });
});
