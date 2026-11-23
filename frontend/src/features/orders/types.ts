/** Mirrors App\Http\Resources\OrderResource */
export type OrderStatus = 'pending' | 'completed' | 'failed' | 'expired' | 'refunding' | 'refunded';

export interface OrderKey {
  id: number;
  code: string;
}

export interface OrderItem {
  id: number;
  product_slug: string | null;
  product_title: string;
  cover_url: string | null;
  platform_name: string;
  region_name: string;
  seller_name: string;
  unit_price_cents: number;
  quantity: number;
  line_total_cents: number;
  /** Only for the owner's completed orders. */
  keys: OrderKey[];
}

export interface Order {
  id: string;
  status: OrderStatus;
  total_cents: number;
  currency: string;
  payment_provider: 'fake' | 'stripe';
  failure_reason: string | null;
  /** While pending: when the reserved keys are released if unpaid. */
  expires_at: string | null;
  created_at: string;
  paid_at: string | null;
  items: OrderItem[];
}

export interface OrdersPage {
  data: Order[];
  meta: { current_page: number; last_page: number; total: number };
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Awaiting payment',
  completed: 'Completed',
  failed: 'Payment failed',
  expired: 'Reservation expired',
  refunding: 'Refund in progress',
  refunded: 'Refunded',
};

/** Pending and still inside its reservation window (the server sweeps expired ones every minute). */
export function isPayable(order: Order, now = Date.now()): boolean {
  return order.status === 'pending' && order.expires_at !== null && new Date(order.expires_at).getTime() > now;
}
