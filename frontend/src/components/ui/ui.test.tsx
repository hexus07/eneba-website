import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { renderWithRouter } from '@/test/renderWithRouter';
import { render } from '@testing-library/react';
import { Badge, Button, Checkbox, PriceTag, ProductCard, QuantityStepper, SectionHeading, Spinner, TextInput } from './index';

describe('Button', () => {
  it('renders each variant as a type="button" by default', () => {
    render(<><Button>Buy now</Button><Button variant="outline">See all</Button><Button variant="secondary">Buy</Button></>);
    for (const b of screen.getAllByRole('button')) expect(b).toHaveAttribute('type', 'button');
    expect(screen.getByRole('button', { name: 'Buy now' })).toHaveClass('bg-accent');
    expect(screen.getByRole('button', { name: 'See all' })).toHaveClass('border-line-default');
  });

  it('is disabled and busy while loading, and shows a spinner instead of the label', () => {
    render(<Button loading>Pay</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
  });

  it('icon buttons are named by aria-label', () => {
    render(<Button variant="icon" aria-label="Add to cart">+</Button>);
    expect(screen.getByRole('button', { name: 'Add to cart' })).toBeInTheDocument();
  });
});

describe('PriceTag', () => {
  it('shows a formatted price with an optional label', () => {
    render(<PriceTag label="From" priceCents={1099} />);
    expect(screen.getByText('From')).toBeInTheDocument();
    expect(screen.getByText('€10.99')).toBeInTheDocument();
  });

  it('discounted variant shows percent and struck-through old price', () => {
    const { container } = render(<PriceTag priceCents={1500} originalPriceCents={6000} />);
    expect(screen.getByText('-75%')).toBeInTheDocument();
    expect(container.querySelector('s')).toHaveTextContent('Was €60.00');
  });

  it('ignores a "was" price that is not higher', () => {
    render(<PriceTag priceCents={1500} originalPriceCents={1500} />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});

describe('Badge', () => {
  it('has a default label per variant', () => {
    render(<><Badge variant="cashback" /><Badge variant="lowestPrice" /><Badge variant="bestCashback">Top</Badge></>);
    expect(screen.getByText('Cashback')).toBeInTheDocument();
    expect(screen.getByText('Lowest price')).toBeInTheDocument();
    expect(screen.getByText('Top')).toBeInTheDocument();
  });
});

describe('ProductCard', () => {
  const props = {
    href: '/product/elden-ring-steam-global', title: 'Elden Ring', coverUrl: 'https://example.test/c.jpg',
    platformName: 'Steam', regionName: 'Global', isGlobal: true, priceCents: 2949,
  };

  it('links the whole card to the product and shows platform, region and price', () => {
    renderWithRouter(<ProductCard {...props} />);
    expect(screen.getByRole('link', { name: 'Elden Ring' })).toHaveAttribute('href', '/product/elden-ring-steam-global');
    expect(screen.getByText('Steam')).toBeInTheDocument();
    expect(screen.getByText('Global')).toHaveClass('text-success');
    expect(screen.getByText('€29.49')).toBeInTheDocument();
  });

  it('colors region-locked keys differently', () => {
    renderWithRouter(<ProductCard {...props} regionName="Europe" isGlobal={false} />);
    expect(screen.getByText('Europe')).toHaveClass('text-fg-region');
  });

  it('add to cart is a real, keyboard-reachable button that calls the handler', async () => {
    const onAdd = vi.fn();
    renderWithRouter(<ProductCard {...props} onAddToCart={onAdd} />);

    await userEvent.tab(); // title link
    await userEvent.tab(); // add to cart
    expect(screen.getByRole('button', { name: /add to cart: elden ring/i })).toHaveFocus();
    await userEvent.keyboard('{Enter}');

    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('hides add to cart and says out of stock when there is no price', () => {
    renderWithRouter(<ProductCard {...props} priceCents={null} onAddToCart={vi.fn()} />);
    expect(screen.getByText('Out of stock')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('falls back to a text placeholder when the cover fails or is missing', () => {
    const { container, unmount } = renderWithRouter(<ProductCard {...props} />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    if (img) fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
    unmount();

    const second = renderWithRouter(<ProductCard {...props} coverUrl={null} />);
    expect(second.container.querySelector('img')).toBeNull();
  });

  it('shows cashback only when given', () => {
    renderWithRouter(<ProductCard {...props} cashbackPercent={8} />);
    expect(screen.getByText('Cashback')).toBeInTheDocument();
    expect(screen.getByText('8% Cashback')).toBeInTheDocument();
  });
});

describe('QuantityStepper', () => {
  function Controlled({ max = 3 }: { max?: number }) {
    const [v, setV] = useState(1);
    return <QuantityStepper value={v} onChange={setV} max={max} itemLabel="Hades" />;
  }

  it('increments, decrements and disables at the bounds', async () => {
    render(<Controlled />);
    const dec = screen.getByRole('button', { name: 'Decrease quantity of Hades' });
    const inc = screen.getByRole('button', { name: 'Increase quantity of Hades' });

    expect(dec).toBeDisabled();
    await userEvent.click(inc);
    await userEvent.click(inc);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(inc).toBeDisabled();
    await userEvent.click(dec);
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

describe('Checkbox', () => {
  it('is a labelled native checkbox', async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Remember me" onChange={onChange} />);
    const box = screen.getByRole('checkbox', { name: 'Remember me' });

    await userEvent.click(screen.getByText('Remember me'));

    expect(box).toBeChecked();
    expect(onChange).toHaveBeenCalledOnce();
  });
});

describe('TextInput', () => {
  it('associates label, hint and error with the input', () => {
    render(<TextInput label="Email" required error="Invalid email" hint="never shown with an error" />);
    const input = screen.getByRole('textbox', { name: /email/i });

    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Invalid email');
    expect(screen.queryByText('never shown with an error')).not.toBeInTheDocument();
  });

  it('can hide its label visually but keep it accessible', () => {
    render(<TextInput label="Newsletter email" hideLabel />);
    expect(screen.getByRole('textbox', { name: 'Newsletter email' })).toBeInTheDocument();
    expect(screen.getByText('Newsletter email')).toHaveClass('sr-only');
  });
});

describe('SectionHeading & Spinner', () => {
  it('renders the requested heading level with an accessible info icon', () => {
    render(<SectionHeading as="h1" info="Why these">Recommended</SectionHeading>);
    expect(screen.getByRole('heading', { level: 1, name: /recommended/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Why these' })).toBeInTheDocument();
  });

  it('spinner announces its label', () => {
    render(<Spinner label="Processing payment" />);
    expect(screen.getByRole('status')).toHaveTextContent('Processing payment');
  });
});
