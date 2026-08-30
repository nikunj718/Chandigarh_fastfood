# Fastfood Delivery

Multi-restaurant food ordering for India, built with Next.js App Router, Supabase anonymous guest sessions, email/password staff access, Leaflet, OpenStreetMap, Razorpay, Zustand, Framer Motion, and an active-shift rider PWA.

## Run locally

1. Copy `.env.example` to `.env.local` and set the values below. Never expose a Supabase service-role key or the credential-encryption key to the browser.
2. In Supabase Auth, enable Anonymous Sign-Ins, Email/Password, Confirm Email, and manual identity linking. Configure SMTP/transactional email plus local and production redirect URLs, including `/staff`.
3. Apply every migration in `supabase/migrations/` to a Supabase project with PostGIS enabled, including `202608300004_restaurant_owner_details.sql`.
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
| `CREDENTIAL_ENCRYPTION_KEY` | Base64-encoded 32-byte server-only key that encrypts each restaurant's Razorpay API and webhook secrets |
| `CUSTOMER_CONTACT_ENCRYPTION_KEY` | Separate base64-encoded 32-byte server-only key that encrypts guest delivery contacts and order snapshots |

## Guest sessions and staff access

Customers enter automatically through a Supabase anonymous session, then browse and order without SMS. A browser-local guest UUID marker supports the experience, but Supabase’s persisted session is the only authentication source; clearing browser data loses an anonymous account.

Every checkout requires a valid Indian delivery phone number. It is encrypted in the customer profile for future checkout prefill and encrypted again as an immutable order snapshot. Plaintext is returned only to the customer, authorized restaurant owners/managers, and the rider assigned to that delivery.

Staff use verified email/password accounts at `/staff`. An anonymous owner can secure their current account from that page: email verification and password setup preserve the existing user ID and restaurant memberships. Owners add managers and riders by their already-confirmed email address.

Publishing a restaurant requires its official name, physical address, owner full name, and owner Gmail address. The address search and map pin work across India, so owners never enter latitude or longitude. For a guest owner, the same Gmail address starts the Supabase email-link flow before the restaurant is published; confirmation and password setup preserve the creator membership.

## Per-restaurant Razorpay setup

There are no platform-wide Razorpay API credentials. Each restaurant owner configures its own Key ID, Key Secret, and Webhook Secret in Operations. The Key Secret and Webhook Secret are AES-256-GCM encrypted before persistence and are never returned by the settings API.

For each restaurant Razorpay account, configure `payment.captured` and `payment.failed` to the public `/api/webhooks/razorpay` endpoint and use that restaurant's Webhook Secret. Razorpay webhook HMAC validation uses this webhook secret, not the API Key Secret. Online orders are confirmed only by a verified `payment.captured` event; the client checkout callback never changes payment status.

## Tenant and role model

- Any authenticated user may create an active restaurant and receives an owner membership for it.
- Each restaurant has isolated categories, items, fees, radius, orders, riders, and live-location points.
- Owners can add verified-email managers and riders. Only owners can configure or remove their restaurant's Razorpay credentials; no membership policy permits assigning the `owner` role from the client.
- Customers retain one persisted cart draft per restaurant. Checkout re-reads all item prices, availability, restaurant coordinates, and delivery quote server-side.

## Delivery and tracking

The cart quote uses a local, conservative distance estimate based on the saved coordinates and rejects deliveries beyond the restaurant's configured `delivery_radius_km`. The fee is `delivery_fee_base + delivery_fee_per_km × route_km`. No map, geocoding, routing, or tile API key is required.

Restaurant pins and tracking maps use Leaflet with OpenStreetMap tiles. Address search makes a single, user-triggered request to the public OpenStreetMap Nominatim service without credentials; requests are cached and locally rate-limited. For a large production deployment, follow Nominatim's usage policy or self-host it rather than increasing public-service traffic.

Riders share GPS every 30 seconds only during an active, foreground, permissioned PWA shift. Mobile browsers can suspend timers/location when backgrounded, so truly guaranteed background tracking requires a native app or a dedicated tracking service.

## Verification

```bash
npm test
npm run build
```

The included tests cover Indian delivery-phone normalization, encrypted contacts and tenant credentials, local delivery-distance estimation, approximate directory distance, and isolated cart-line behavior. Live Supabase, Razorpay, RLS, email-confirmation, and webhook tests require configured project credentials.
