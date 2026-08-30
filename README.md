# Fastfood Delivery

Multi-restaurant food ordering for India, built with Next.js App Router, Supabase Email/Password and Google OAuth authentication, Leaflet, OpenStreetMap, Razorpay, Zustand, Framer Motion, and an active-shift rider PWA.

## Run locally

1. Copy `.env.example` to `.env.local` and set the values below. Never expose a Supabase service-role key or the credential-encryption key to the browser.
2. In Supabase Auth, enable Email/Password and Confirm Email; disable Anonymous Sign-Ins and Phone Auth. Configure SMTP/transactional email and add local and production `/auth/callback` URLs to the redirect allowlist.
3. Enable the Google provider in Supabase. In Google Cloud, configure the Supabase provider callback URI (`https://<project-ref>.supabase.co/auth/v1/callback`), then add the application callback URL from step 2 in Supabase.
4. Apply every migration in `supabase/migrations/` to a Supabase project with PostGIS enabled, including `202608300006_standard_auth_cutover.sql`.
5. Enable Realtime replication for `delivery_location_points` if your Supabase project does not automatically respect the migration publication change.
6. Install and start the app:

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
| `CUSTOMER_CONTACT_ENCRYPTION_KEY` | Separate base64-encoded 32-byte server-only key that encrypts delivery contacts and order snapshots |

## Customer and staff access

Anyone can browse active restaurants and menus. Ordering, saved addresses, restaurant publishing, Operations, rider shifts, and private tracking require a confirmed Email/Password account or Google OAuth account. The app never creates anonymous sessions, sends SMS OTPs, or stores a guest user marker.

Returning confirmed users never see a login portal at `/` or `/staff`: customers and rider-only users go to `/restaurants`, one owner/manager restaurant opens its Operations dashboard, and multiple owner/manager memberships open the protected `/admin` restaurant picker. A safe requested URL—such as a particular dashboard or order-tracking page—always wins over this automatic landing rule.

Every checkout requires a valid Indian delivery phone number. It is encrypted in the customer profile for future checkout prefill and encrypted again as an immutable order snapshot. Plaintext is returned only to the customer, authorized restaurant owners/managers, and the rider assigned to that delivery.

Staff use the same verified Email/Password or Google sign-in at `/staff`. Owners add managers and riders by their already-confirmed email address.

Publishing a restaurant requires its official name, physical address, and owner full name. The verified account email is shown read-only and is stored as the owner email; any verified email domain is supported. The address search and map pin work across India, so owners never enter latitude or longitude.

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
