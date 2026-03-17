import Razorpay from "razorpay";

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

export const razorpay: Razorpay | null =
  keyId && keySecret
    ? new Razorpay({ key_id: keyId, key_secret: keySecret })
    : null;

export const isTestMode = keyId?.startsWith("rzp_test_") ?? false;

export function getRazorpayKeyId(): string | null {
  return keyId ?? null;
}

export interface RazorpayPaymentEntity {
  id: string;
  status: string;
  order_id: string;
  amount: number;
  currency: string;
}

export interface RazorpayOrderEntity {
  id: string;
  status: string;
  amount: number;
  currency: string;
  notes: Record<string, string>;
}

interface RazorpayTransferItem {
  id: string;
}

interface RazorpayTransferResponse {
  items?: RazorpayTransferItem[];
  id?: string;
}

interface RazorpayContact {
  id: string;
}

interface RazorpayFundAccount {
  id: string;
}

type RazorpaySDK = {
  payments: {
    fetch(id: string): Promise<RazorpayPaymentEntity>;
    transfer(id: string, data: { transfers: { account: string; amount: number; currency: string }[] }): Promise<RazorpayTransferResponse>;
  };
  orders: {
    fetch(id: string): Promise<RazorpayOrderEntity>;
    create(data: Record<string, unknown>): Promise<{ id: string; amount: number; currency: string }>;
  };
  contacts: {
    create(data: { name: string; email?: string; type: string; reference_id: string }): Promise<RazorpayContact>;
  };
  fundAccount: {
    create(data: Record<string, unknown>): Promise<RazorpayFundAccount>;
  };
};

function getRazorpaySDK(): RazorpaySDK {
  if (!razorpay) throw new Error("Razorpay not configured");
  return razorpay as unknown as RazorpaySDK;
}

export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPaymentEntity> {
  return getRazorpaySDK().payments.fetch(paymentId);
}

export async function fetchRazorpayOrder(orderId: string): Promise<RazorpayOrderEntity> {
  return getRazorpaySDK().orders.fetch(orderId);
}

export async function createRazorpayOrder(data: Record<string, unknown>): Promise<{ id: string; amount: number; currency: string }> {
  return getRazorpaySDK().orders.create(data);
}

export async function createRouteTransfer(
  paymentId: string,
  transfers: { account: string; amount: number; currency: string }[]
): Promise<string> {
  const result = await getRazorpaySDK().payments.transfer(paymentId, { transfers });
  const transferId = result?.items?.[0]?.id ?? result?.id;
  if (!transferId) throw new Error("Transfer ID not returned from Razorpay");
  return transferId;
}

export async function createRazorpayContact(data: {
  name: string;
  email?: string;
  type: string;
  reference_id: string;
}): Promise<RazorpayContact> {
  return getRazorpaySDK().contacts.create(data);
}

export async function createRazorpayFundAccount(data: Record<string, unknown>): Promise<RazorpayFundAccount> {
  return getRazorpaySDK().fundAccount.create(data);
}
