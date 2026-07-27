import { AppLauncher } from '@capacitor/app-launcher';
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

/**
 * What to put on the clipboard before handing off to a payment app.
 *
 * Vipps and MobilePay open on their own home screen with nothing pre-filled — their public
 * schemes carry no recipient or amount — so the user has to type both. Copying the handle alone
 * (what we did before, and only on failure) still left them re-reading the amount from memory.
 * The recipient is the one field the app can't guess, so it leads.
 */
export function clipboardPayload(method: PaymentMethod, amount: number): string {
  const rounded = Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null;
  if (method.provider === 'paypal' || rounded === null) return method.value;
  return `${method.value} — ${rounded}`;
}

/** True when the app being opened cannot pre-fill, so the user must paste the details in. */
export function needsManualEntry(method: PaymentMethod): boolean {
  return method.provider === 'vipps' || method.provider === 'mobilepay' || method.provider === 'bank';
}

/**
 * Opens a payment link, using the in-app browser for https and the app scheme for native
 * deep-links. Returns false when the target app is not installed (the schemes are declared
 * in LSApplicationQueriesSchemes / the Android <queries> manifest so canOpenUrl is allowed),
 * letting the caller fall back to copying the handle instead of failing silently.
 */
export async function openPaymentLink(url: string): Promise<boolean> {
  if (url.startsWith('https://')) {
    await Browser.open({ url });
    return true;
  }
  // Custom app scheme (vipps://, mobilepay://)
  if (Capacitor.isNativePlatform()) {
    try {
      const { value: canOpen } = await AppLauncher.canOpenUrl({ url });
      if (!canOpen) return false;
      const { completed } = await AppLauncher.openUrl({ url });
      return completed;
    } catch {
      return false;
    }
  }
  window.open(url, '_blank');
  return true;
}
