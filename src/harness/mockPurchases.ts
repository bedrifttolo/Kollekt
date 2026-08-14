// Harness-only stand-in for '../lib/purchases', swapped in by vite.harness.config.ts.
// RevenueCat needs a native bridge, so in a plain browser the real module either no-ops or throws
// depending on timing. Pinning it here keeps the paywall and the game-lock states deterministic:
// pass ?premium=1 to render every screen as an unlocked user.
import type { LifetimeUnlock } from '../lib/purchases';

const premium = new URLSearchParams(window.location.search).get('premium') === '1';

export const PREMIUM_ENTITLEMENT_ID = 'premium_lifetime';
export const LIFETIME_PRODUCT_ID = 'kollekt_lifetime_unlock';
export const PURCHASES_CONFIGURED = true;

export async function initPurchases(): Promise<void> {}
export async function identifyPurchaser(_memberName: string): Promise<void> {}
export async function resetPurchaser(): Promise<void> {}

export function usePremiumEntitlement(): LifetimeUnlock {
  return {
    available: true,
    isUnlocked: premium,
    priceString: '199,00 kr',
    loading: false,
    purchase: async () => premium,
    restore: async () => premium,
  };
}

export function isGameLocked(requiresSubscription: boolean | undefined, isUnlocked: boolean): boolean {
  return Boolean(requiresSubscription) && !isUnlocked;
}
