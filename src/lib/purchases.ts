import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';

// Single premium entitlement gating the game hub + chat GIFs, sold as a one-time
// lifetime unlock (29 kr, non-consumable) via RevenueCat / App Store In-App Purchase.
//
// Setup that lives outside this repo (App Store Connect / Play Console + RevenueCat
// dashboard) is documented in release/REVENUECAT_SETUP.md (iOS) and
// release/ANDROID_RELEASE_SETUP.md (Android). Once that's done, set
// VITE_REVENUECAT_API_KEY_IOS / VITE_REVENUECAT_API_KEY_ANDROID in .env.mobile and this
// module activates automatically per-platform — no code change needed.

export const PREMIUM_ENTITLEMENT_ID = 'premium_lifetime';
export const LIFETIME_PRODUCT_ID = 'kollekt_lifetime_unlock';

const API_KEY_IOS = import.meta.env.VITE_REVENUECAT_API_KEY_IOS as string | undefined;
const API_KEY_ANDROID = import.meta.env.VITE_REVENUECAT_API_KEY_ANDROID as string | undefined;

/** True once a platform-appropriate RevenueCat API key is present in the build. */
export const PURCHASES_CONFIGURED = !!API_KEY_IOS || !!API_KEY_ANDROID;

let configured = false;

/** Configure the RevenueCat SDK once at app startup. No-ops on web or without a key. */
export async function initPurchases(): Promise<void> {
  if (configured || !Capacitor.isNativePlatform() || !PURCHASES_CONFIGURED) return;
  const apiKey = Capacitor.getPlatform() === 'ios' ? API_KEY_IOS : API_KEY_ANDROID;
  if (!apiKey) return;
  configured = true;
  try {
    await Purchases.setLogLevel({ level: import.meta.env.DEV ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR });
    await Purchases.configure({ apiKey });
  } catch {
    configured = false;
  }
}

/** Link the RevenueCat customer to the signed-in member so entitlements follow the account. */
export async function identifyPurchaser(memberName: string): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logIn({ appUserID: memberName });
  } catch {
    // Best-effort; the anonymous RevenueCat identity still works for this session.
  }
}

/** Drop the RevenueCat identity back to anonymous on logout. */
export async function resetPurchaser(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch {
    // Best-effort cleanup.
  }
}

export interface LifetimeUnlock {
  /** Whether the purchase layer is live yet (API key present, native platform). */
  available: boolean;
  /** Whether the current user already owns the lifetime unlock. */
  isUnlocked: boolean;
  /** Localized store price for the paywall (e.g. "29,00 kr"), once fetched. */
  priceString: string | null;
  loading: boolean;
  /** Starts the purchase flow. Resolves to the new unlock state. */
  purchase: () => Promise<boolean>;
  /** Restores a prior purchase (required by App Store review for non-consumables). */
  restore: () => Promise<boolean>;
}

function hasEntitlement(customerInfo: { entitlements: { active: Record<string, unknown> } }): boolean {
  return PREMIUM_ENTITLEMENT_ID in customerInfo.entitlements.active;
}

async function fetchEntitlement(): Promise<boolean> {
  if (!configured) return false;
  const { customerInfo } = await Purchases.getCustomerInfo();
  return hasEntitlement(customerInfo);
}

async function fetchPriceString(): Promise<string | null> {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages[0];
    return pkg?.product.priceString ?? null;
  } catch {
    return null;
  }
}

async function runPurchase(): Promise<boolean> {
  if (!configured) throw new Error('purchases-unavailable');
  const offerings = await Purchases.getOfferings();
  const pkg = offerings.current?.availablePackages[0];
  if (!pkg) throw new Error('purchases-unavailable');
  const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
  return hasEntitlement(customerInfo);
}

async function runRestore(): Promise<boolean> {
  if (!configured) throw new Error('purchases-unavailable');
  const { customerInfo } = await Purchases.restorePurchases();
  return hasEntitlement(customerInfo);
}

/** React hook exposing the lifetime-unlock entitlement + purchase/restore actions. */
export function usePremiumEntitlement(): LifetimeUnlock {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [priceString, setPriceString] = useState<string | null>(null);
  const [loading, setLoading] = useState(PURCHASES_CONFIGURED);

  useEffect(() => {
    let cancelled = false;
    if (!PURCHASES_CONFIGURED) {
      setLoading(false);
      return;
    }
    Promise.all([fetchEntitlement(), fetchPriceString()])
      .then(([active, price]) => {
        if (cancelled) return;
        setIsUnlocked(active);
        setPriceString(price);
      })
      .catch(() => { if (!cancelled) setIsUnlocked(false); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const purchase = useCallback(async () => {
    const active = await runPurchase();
    setIsUnlocked(active);
    return active;
  }, []);

  const restore = useCallback(async () => {
    const active = await runRestore();
    setIsUnlocked(active);
    return active;
  }, []);

  return { available: PURCHASES_CONFIGURED, isUnlocked, priceString, loading, purchase, restore };
}

/** True when a game is gated and the user has no active entitlement. */
export function isGameLocked(requiresSubscription: boolean | undefined, isUnlocked: boolean): boolean {
  return !!requiresSubscription && !isUnlocked;
}
