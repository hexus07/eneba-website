import { useState } from 'react';
import { Button } from '@/components/ui';
import { toast } from '@/lib/toastStore';
import type { OrderKey } from './types';

const MASK = '•••••-•••••-•••••';

/** One purchased key: hidden until revealed (shoulder-surfing), then copyable. */
function KeyRow({ productTitle, index, keyData }: { productTitle: string; index: number; keyData: OrderKey }) {
  const [revealed, setRevealed] = useState(false);
  const label = `${productTitle} key ${index + 1}`;

  const copy = () => {
    navigator.clipboard.writeText(keyData.code).then(
      () => toast('Key copied to the clipboard'),
      () => toast('Couldn’t copy. Select the key and copy it manually.', 'error'),
    );
  };

  return (
    <li className="flex flex-wrap items-center gap-10 bg-surface-card/40 p-10">
      <code aria-label={revealed ? label : `${label} (hidden)`} className="flex-1 font-bold tracking-wider text-fg-primary select-all">
        {revealed ? keyData.code : MASK}
      </code>
      {revealed ? (
        <Button variant="secondary" size="sm" onClick={copy} aria-label={`Copy ${label}`}>Copy</Button>
      ) : (
        <Button variant="primary" size="sm" onClick={() => setRevealed(true)} aria-label={`Reveal ${label}`}>Reveal key</Button>
      )}
    </li>
  );
}

export function OrderKeys({ productTitle, keys }: { productTitle: string; keys: OrderKey[] }) {
  return (
    <ul className="flex flex-col gap-8" aria-label={`Keys for ${productTitle}`}>
      {keys.map((k, i) => <KeyRow key={k.id} productTitle={productTitle} index={i} keyData={k} />)}
    </ul>
  );
}
