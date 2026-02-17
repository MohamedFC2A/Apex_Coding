import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SubscriptionTier = 'FREE' | 'PRO';

interface SubscriptionState {
  tier: SubscriptionTier;
  requestsUsedToday: number;
  dailyLimit: number;
  lastResetDate: string;
  promoCode: string | null;
  
  // Actions
  setTier: (tier: SubscriptionTier) => void;
  incrementRequests: () => boolean;
  canMakeRequest: () => boolean;
  resetIfNewDay: () => void;
  applyPromoCode: (code: string) => boolean;
  getRemainingRequests: () => number;
}

const LIMITS = {
  FREE: 10,
  PRO: 100
};

const VALID_PROMO_CODE = '01224465998';

const normalizePromoCode = (code: string) => String(code || '').trim().replace(/[\s-]+/g, '');

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      tier: 'FREE',
      requestsUsedToday: 0,
      dailyLimit: LIMITS.FREE,
      lastResetDate: new Date().toDateString(),
      promoCode: null,

      setTier: (tier) => {
        set({
          tier,
          dailyLimit: LIMITS[tier],
          requestsUsedToday: 0
        });
      },

      incrementRequests: () => {
        const state = get();
        state.resetIfNewDay();
        
        if (!state.canMakeRequest()) {
          return false;
        }
        
        set({ requestsUsedToday: state.requestsUsedToday + 1 });
        return true;
      },

      canMakeRequest: () => {
        const state = get();
        state.resetIfNewDay();
        return state.requestsUsedToday < state.dailyLimit;
      },

      resetIfNewDay: () => {
        const state = get();
        const today = new Date().toDateString();
        
        if (state.lastResetDate !== today) {
          set({
            requestsUsedToday: 0,
            lastResetDate: today
          });
        }
      },

      applyPromoCode: (code: string) => {
        const normalized = normalizePromoCode(code);
        if (normalized === VALID_PROMO_CODE) {
          set({
            tier: 'PRO',
            dailyLimit: LIMITS.PRO,
            promoCode: VALID_PROMO_CODE,
            requestsUsedToday: 0
          });
          return true;
        }
        return false;
      },

      getRemainingRequests: () => {
        const state = get();
        state.resetIfNewDay();
        return Math.max(0, state.dailyLimit - state.requestsUsedToday);
      }
    }),
    {
      name: 'apex-subscription',
      version: 1
    }
  )
);
