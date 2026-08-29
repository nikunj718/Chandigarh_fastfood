# Chandigarh Fastfood

Multi-restaurant food ordering for India, built with Next.js App Router, Supabase Phone Auth, Mapbox, Razorpay, Zustand, Framer Motion, and an active-shift rider PWA.

## Run locally

1. Copy `.env.example` to `.env.local` and set the values below. Never expose a Supabase service-role key, Razorpay secret, or webhook secret to the browser.
2. In Supabase, enable Phone Auth, configure an SMS provider, and add the local/production redirect URLs as appropriate.
3. Apply `supabase/migrations/202608290001_multi_restaurant_platform.sql` to a fresh Supabase project with PostGIS enabled.
4. Enable Realtime replication for `delivery_location_points` if your Supabase project does not automatically respect the migration publication change.
5. Install and start the app:

```bash
npm install
npm run dev
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser and user-scoped server access |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only checkout, payment webhook, and team invitation writes |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Browser maps and owner pin picker |
| `MAPBOX_SECRET_TOKEN` | Server-only address search and Directions quotes/ETAs |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Creating Razorpay payment orders |
| `RAZORPAY_WEBHOOK_SECRET` | Verifying Razorpay webhook HMAC signatures |

Configure Razorpay to send `payment.captured` and `payment.failed` events to `/api/webhooks/razorpay`. Online orders are confirmed only by a verified `payment.captured` event; the client checkout callback never changes payment status.

## Tenant and role model

- Any authenticated user may create an active restaurant and receives an owner membership for it.
- Each restaurant has isolated categories, items, fees, radius, orders, riders, and live-location points.
- Owners can add phone-authenticated managers and riders. No membership policy permits assigning the `owner` role from the client.
- Customers retain one persisted cart draft per restaurant. Checkout re-reads all item prices, availability, restaurant coordinates, and delivery quote server-side.

## Delivery and tracking

The cart quote uses Mapbox driving distance and rejects routes beyond the restaurant's configured `delivery_radius_km`. The fee is `delivery_fee_base + delivery_fee_per_km × route_km`.

Riders share GPS every 30 seconds only during an active, foreground, permissioned PWA shift. Mobile browsers can suspend timers/location when backgrounded, so truly guaranteed background tracking requires a native app or a dedicated tracking service.

## Verification

```bash
npm test
npm run build
```

The included tests cover Indian phone normalization, delivery math, approximate directory distance, and isolated cart-line behavior. Live Supabase, Mapbox, Razorpay, RLS, and webhook tests require configured project credentials.
