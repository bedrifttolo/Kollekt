import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import type { PaymentHandles } from './types';

export type PaymentProvider = 'vipps' | 'mobilepay' | 'paypal' | 'bank';

export interface PaymentMethod {
  provider: PaymentProvider;
  /** The handle to display and let the user copy (phone, paypal.me name, account number). */
  value: string;
  /**
   * A link to launch. For PayPal this opens paypal.me with the amount pre-filled.
   * For Vipps/MobilePay it opens the app (their public schemes do not accept a
   * pre-filled P2P amount, so the user enters the amount shown). Null for bank
   * transfer, where the user copies the account number into their bank app.
   */
  url: string | null;
}

/** Lists the payment methods a creditor has actually registered, in display order. */
export function availableMethods(handles: PaymentHandles, amount: number): PaymentMethod[] {
  const methods: PaymentMethod[] = [];
  const payableAmount = Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null;
  if (handles.vipps) {
    methods.push({ provider: 'vipps', value: handles.vipps, url: 'vipps://' });
  }
  if (handles.mobilepay) {
    methods.push({ provider: 'mobilepay', value: handles.mobilepay, url: 'mobilepay://' });
  }
  if (handles.paypal) {
    methods.push({
      provider: 'paypal',
      value: handles.paypal,
      url: payableAmount === null
        ? null
        : `https://www.paypal.com/paypalme/${encodeURIComponent(handles.paypal)}/${payableAmount}NOK`,
    });
  }
  if (handles.bankAccount) {
    methods.push({ provider: 'bank', value: handles.bankAccount, url: null });
  }
  return methods;
}

export function hasAnyMethod(handles: PaymentHandles | undefined): boolean {
  return !!(handles && (handles.vipps || handles.mobilepay || handles.paypal || handles.bankAccount));
}

/** Opens a payment link, using the in-app browser for https and the app scheme for native deep-links. */
export async function openPaymentLink(url: string): Promise<void> {
  if (url.startsWith('https://')) {
    await Browser.open({ url });
    return;
  }
  // Custom app scheme (vipps://, mobilepay://)
  if (Capacitor.isNativePlatform()) {
    window.location.href = url;
  } else {
    window.open(url, '_blank');
  }
}
