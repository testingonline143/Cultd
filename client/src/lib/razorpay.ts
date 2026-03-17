declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
}

interface RazorpayInstance {
  open(): void;
  close(): void;
}

let scriptLoaded = false;
let scriptLoading: Promise<void> | null = null;

export function loadRazorpay(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (scriptLoading) return scriptLoading;

  scriptLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => { scriptLoaded = true; resolve(); };
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
    document.head.appendChild(script);
  });

  return scriptLoading;
}

export interface RazorpayOrderDetails {
  orderId: string;
  amount: number;
  baseAmount: number;
  platformFee: number;
  currency: string;
  keyId: string;
  isTestMode: boolean;
  ticketTypeId: number;
  ticketTypeName: string;
  eventTitle: string;
  clubName: string;
}

export interface OpenRazorpayCheckoutOptions {
  order: RazorpayOrderDetails;
  userEmail?: string;
  userName?: string;
  onSuccess: (paymentId: string, orderId: string, signature: string) => void;
  onDismiss?: () => void;
}

export async function openRazorpayCheckout(opts: OpenRazorpayCheckoutOptions): Promise<void> {
  await loadRazorpay();

  if (!window.Razorpay) {
    throw new Error("Razorpay not available");
  }

  return new Promise<void>((resolve) => {
    const rzp = new window.Razorpay({
      key: opts.order.keyId,
      amount: opts.order.amount,
      currency: opts.order.currency,
      name: "CultFam",
      description: `${opts.order.ticketTypeName} — ${opts.order.eventTitle}`,
      order_id: opts.order.orderId,
      prefill: {
        name: opts.userName,
        email: opts.userEmail,
      },
      theme: { color: "#C4622D" },
      modal: {
        ondismiss: () => {
          opts.onDismiss?.();
          resolve();
        },
      },
      handler: (response) => {
        opts.onSuccess(response.razorpay_payment_id, response.razorpay_order_id, response.razorpay_signature);
        resolve();
      },
    });
    rzp.open();
  });
}
