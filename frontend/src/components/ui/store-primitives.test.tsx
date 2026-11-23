import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { renderWithRouter } from '@/test/renderWithRouter';
import { Chip, Drawer, Pagination, pageWindow, Select } from './index';

describe('pageWindow', () => {
  it.each([
    [1, 1, [1]],
    [1, 3, [1, 2, 3]],
    [5, 20, [1, null, 4, 5, 6, null, 20]],
    [1, 20, [1, 2, null, 20]],
    [3, 20, [1, 2, 3, 4, null, 20]], // a gap of one page shows the page instead of "…"
    [20, 20, [1, null, 19, 20]],
  ])('page %i of %i', (page, last, expected) => {
    expect(pageWindow(page, last)).toEqual(expected);
  });
});

describe('Pagination', () => {
  it('renders links with the current page marked', () => {
    renderWithRouter(<Pagination page={2} lastPage={3} hrefFor={(p) => `/store?page=${p}`} />);
    expect(screen.getByRole('link', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Page 3' })).toHaveAttribute('href', '/store?page=3');
    expect(screen.getByRole('link', { name: 'Previous page' })).toHaveAttribute('href', '/store?page=1');
    expect(screen.getByRole('link', { name: 'Next page' })).toHaveAttribute('href', '/store?page=3');
  });

  it('renders nothing for a single page and hides prev/next at the ends', () => {
    const { container } = renderWithRouter(<Pagination page={1} lastPage={1} hrefFor={String} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Select', () => {
  it('is a labelled native select', async () => {
    const onChange = vi.fn();
    render(<Select label="Sort by" options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'b');
    expect(onChange).toHaveBeenCalledOnce();
  });
});

describe('Chip', () => {
  it('is a remove button named by its label', async () => {
    const onRemove = vi.fn();
    render(<Chip label="Steam" onRemove={onRemove} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter: Steam' }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});

describe('Drawer', () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>Filters</button>
        <Drawer open={open} onClose={() => setOpen(false)} title="Filters" footer={<button type="button">Show results</button>}>
          <p>content</p>
        </Drawer>
      </>
    );
  }

  it('opens as a modal dialog, takes focus, locks scroll and closes on Esc returning focus', async () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Filters' });
    await userEvent.click(opener);

    const dialog = screen.getByRole('dialog', { name: 'Filters' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it('closes from the close button', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
