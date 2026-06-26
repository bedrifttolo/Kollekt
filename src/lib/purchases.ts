import { useCallback, useEffect, useState } from 'react';

// Games subscription entitlement layer.
//
// This is intentionally INERT until two external things exist:
//   1. An auto-renewable subscription product in App Store Connect (and Google Play),
//      with id `GAMES_SUBSCRIPTION_PRODUCT_ID`.
//   2. A StoreKit/Billing bridge — recommended: RevenueCat's `@revenuecat/purchases-capacitor`.
//
// To go live:
//   - `npm i @revenuecat/purchases-capacitor`
//   - configure it on app start (with your RevenueCat API key)
//   - set `PURCHASES_CONFIGURED = true`
//   - implement `fetchEntitlement`, `runPurchase`, `runRestore` below against the plugin
//     (query `customerInfo.entitlements.active[GAMES_ENTITLEMENT_ID]`).
//
// Until then the gate still works: premium games are locked, the paywall renders, and
// purchase/restore report "unavailable" instead of charging anyone.

export const GAMES_ENTITLEMENT_ID = 'games_premium';
export const GAMES_SUBSCRIPTION_PRODUCT_ID = 'kollekt_games_monthly';

/** Flip to `true` once the store product + RevenueCat (or StoreKit) bridge are wired. */
export const PURCHASES_CONFIGURED = false;

export interface GamesSubscription {
  /** Whether the games subscription/IAP layer is live yet. */
  available: boolean;
  /** Whether the current user has the active premium-games entitlement. */
  isSubscriber: boolean;
  loading: boolean;
  /** Starts the purchase flow. Resolves to the new subscriber state. */
  purchase: () => Promise<boolean>;
  /** Restores prior purchases (App Store requires a visible Restore action). */
  restore: () => Promise<boolean>;
}

// --- Store bridge stubs (replace the bodies when PURCHASES_CONFIGURED becomes true) ---

async function fetchEntitlement(): Promise<boolean> {
  if (!PURCHASES_CONFIGURED) return false;
  // e.g. const info = await Purchases.getCustomerInfo();
  //      return GAMES_ENTITLEMENT_ID in info.customerInfo.entitlements.active;
  return false;
}

async function runPurchase(): Promise<boolean> {
  if (!PURCHASES_CONFIGURED) throw new Error('purchases-unavailable');
  // e.g. const offerings = await Purchases.getOfferings();
  //      const pkg = offerings.current?.availablePackages[0];
  //      const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
  //      return GAMES_ENTITLEMENT_ID in customerInfo.entitlements.active;
  return false;
}

async function runRestore(): Promise<boolean> {
  if (!PURCHASES_CONFIGURED) throw new Error('purchases-unavailable');
  // e.g. const { customerInfo } = await Purchases.restorePurchases();
  //      return GAMES_ENTITLEMENT_ID in customerInfo.entitlements.active;
  return false;
}

/** React hook exposing the games entitlement + purchase/restore actions. */
export function useGamesSubscription(): GamesSubscription {
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [loading, setLoading] = useState(PURCHASES_CONFIGURED);

  useEffect(() => {
    let cancelled = false;
    if (!PURCHASES_CONFIGURED) {
      setLoading(false);
      return;
    }
    fetchEntitlement()
      .then((active) => { if (!cancelled) setIsSubscriber(active); })
      .catch(() => { if (!cancelled) setIsSubscriber(false); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const purchase = useCallback(async () => {
    const active = await runPurchase();
    setIsSubscriber(active);
    return active;
  }, []);

  const restore = useCallback(async () => {
    const active = await runRestore();
    setIsSubscriber(active);
    return active;
  }, []);

  return { available: PURCHASES_CONFIGURED, isSubscriber, loading, purchase, restore };
}

/** True when a game is gated and the user has no active entitlement. */
export function isGameLocked(requiresSubscription: boolean | undefined, isSubscriber: boolean): boolean {
  return !!requiresSubscription && !isSubscriber;
}
