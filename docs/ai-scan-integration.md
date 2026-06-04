# Photo AI Scan Integration

This project now has a real client/server contract for the food photo scan flow.

## External services you need

1. Supabase
   - Database for `meal_logs`, `meal_log_items`, `foods`, and `daily_summaries`
   - Edge Functions for the photo scan endpoint
   - Optional Storage if you want to persist original food photos

2. OpenAI API
   - Used by `supabase/functions/food-scan`
   - Recommended model for MVP: `gpt-4o-mini`
   - Required env vars:
     - `OPENAI_API_KEY`
     - optional `OPENAI_MODEL`

3. Optional barcode food database API
   - For packaged food lookup later
   - Good options:
     - Open Food Facts API
     - Nutritionix API

4. Existing subscription service
   - RevenueCat is already wired for premium gating

5. Existing analytics/error tracking
   - PostHog and Sentry are already present in the app

## Current behavior

- If Supabase is not configured, the app uses a local demo scan result.
- If Supabase is configured but OpenAI is not, the Edge Function still returns a demo result.
- Once OpenAI is configured, the scan endpoint will return model-generated nutrition estimates.

## Client flow

1. User takes or uploads a food photo in `app/(tabs)/explore.tsx`
2. The app calls the `food-scan` Edge Function
3. The scan result is displayed in the UI
4. Saving the scan writes a meal log and meal items to Supabase