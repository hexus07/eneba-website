import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Appearance, type Stripe } from '@stripe/stripe-js';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type SyntheticEvent } from 'react';
import { Button, Skeleton } from '@/components/ui';
import { orderKey } from '@/features/orders/api';
import type { Order } from '@/features/orders/types';
import { formatMoney } from '@/lib/money';
import { usePaymentSession } from './api';

// One Stripe.js instance per publishable key (loadStripe must not run on every render).
const stripes = new Map<string, Promise<Stripe | null>>();
function stripeFor(publishableKey: string) {
  let stripe = stripes.get(publishableKey);
  if (!stripe) {
    stripe = loadStripe(publishableKey);
    stripes.set(publishableKey, stripe);
  }
  return stripe;
}

// Stripe renders its fields in its own iframe: dark theme to match the page, square corners like our inputs.
const appearance: Appearance = { theme: 'night', variables: { borderRadius: '0px' } };

/**
 * Stripe test mode: the card form (Payment Element) confirms the PaymentIntent in the browser.
 * The order is fulfilled only by the signed webhook; this page then sees it complete by polling.
 */
export function StripePayment({ order }: { order: Order }) {
  const { data: session, isPending, isError, refetch } = usePaymentSession(order.id, true);

  if (isPending) return <Skeleton className="h-[220px] w-full" aria-label="Loading the payment form" />;
  if (isError || session?.provider !== 'stripe' || !session.publishable_key) {
    return (
      <div role="alert" className="flex flex-col gap-12 text-body-sm text-fg-secondary">
        <p>{isError ? 'We couldn’t start the payment.' : 'Card payments aren’t configured on this server (missing Stripe publishable key).'}</p>
        {isError && <Button variant="outline" onClick={() => void refetch()}>Try again</Button>}
      </div>
    );
  }

  return (
    <Elements stripe={stripeFor(session.publishable_key)} options={{ clientSecret: session.client_secret, appearance }}>
      <CardForm order={order} />
    </Elements>
  );
}

function CardForm({ order }: { order: Order }) {
  const stripe = useStripe();
  const elements = useElements();
  const queryClient = useQueryClient();
  const [state, setState] = useState<'idle' | 'paying' | 'confirming'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setState('paying');
    setError(null);
    const result = await stripe.confirmPayment({
      elements,
      // Only redirect-based methods (e.g. 3-D Secure pages) leave the page; they come back here.
      confirmParams: { return_url: `${window.location.origin}/checkout/pay/${order.id}` },
      redirect: 'if_required',
    });
    if (result.error) {
      // Declined card etc.: the order stays pending and the same intent can be retried.
      setError(result.error.message ?? 'The payment couldn’t be processed. Try again.');
      setState('idle');
      return;
    }
    setState('confirming');
    void queryClient.invalidateQueries({ queryKey: orderKey(order.id) });
    void queryClient.invalidateQueries({ queryKey: ['cart'] });
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
  };

  if (state === 'confirming') {
    return <p role="status" className="bg-surface-card p-12 text-body-sm text-fg-secondary">Payment received. Confirming it with the bank… your keys appear in a moment.</p>;
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-15">
      <p className="text-body-sm text-fg-muted">
        Stripe test mode: no real money moves. Use card <strong className="text-fg-primary">4242 4242 4242 4242</strong>, any future date and any CVC
        (<strong className="text-fg-primary">4000 0000 0000 0002</strong> is declined).
      </p>
      <PaymentElement />
      {error && <p role="alert" className="text-body-sm text-fg-region">{error}</p>}
      <Button type="submit" size="lg" fullWidth loading={state === 'paying'} disabled={!stripe || !elements || state !== 'idle'}>
        Pay {formatMoney(order.total_cents, order.currency)}
      </Button>
    </form>
  );
}
