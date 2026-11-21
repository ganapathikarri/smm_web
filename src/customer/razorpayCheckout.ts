/** Razorpay Standard Web Checkout. Never include API secrets here. */
export type RazorpayCheckoutResult = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type CheckoutOptions = {
  key: string;
  amount: number;
  currency: 'INR';
  name: string;
  description: string;
  order_id: string;
  theme?: { color: string };
  handler: (result: RazorpayCheckoutResult) => void;
  modal?: { ondismiss: () => void; escape?: boolean };
};

type RazorpayInstance = {
  open(): void;
  on(event: 'payment.failed', cb: (event: { error?: { description?: string; reason?: string } }) => void): void;
};

declare global {
  interface Window {
    Razorpay?: new (options: CheckoutOptions) => RazorpayInstance;
  }
}
let loader: Promise<void> | null = null;
export function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (!loader) {
    loader = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => window.Razorpay ? resolve() : reject(new Error('Razorpay Checkout did not load.'));
      script.onerror = () => reject(new Error('Could not load secure payment checkout. Check your connection.'));
      document.head.appendChild(script);
    }).catch(err => { loader = null; throw err; });
  }
  return loader;
}

export async function openCheckout(args: {
  orderId: string;
  keyId: string;
  amountInPaise: number;
  onSuccess: (result: RazorpayCheckoutResult) => void;
  onDismiss: () => void;
  onFailed: (message: string) => void;
}): Promise<void> {
  if (!/^order_[A-Za-z0-9]+$/.test(args.orderId) ||
      !/^rzp_(test|live)_[A-Za-z0-9]+$/.test(args.keyId) ||
      !Number.isSafeInteger(args.amountInPaise) || args.amountInPaise < 100) {
    throw new Error('The payment order details are incomplete. Please contact support.');
  }
  await loadCheckout();
  if (!window.Razorpay) throw new Error('Razorpay Checkout is unavailable.');
  const instance = new window.Razorpay({
    key: args.keyId,
    amount: args.amountInPaise,
    currency: 'INR',
    name: 'SocialSuite',
    description: 'SMM Platform · Wallet top-up',
    order_id: args.orderId,
    theme: { color: '#6f5bd2' },
    handler: args.onSuccess,
    modal: { ondismiss: args.onDismiss, escape: true },
  });
  instance.on('payment.failed', result => args.onFailed(result.error?.description || 'The payment was not completed.'));
  instance.open();
}
