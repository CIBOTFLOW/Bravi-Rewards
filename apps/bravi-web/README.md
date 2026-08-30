# Bravi web v0.6

Mobile-first member application and server-only BFF for Bravi Rewards.

## Run

```bash
npm install
npm run dev
```

Non-production uses an explicit no-effect demo member and wallet when Rewards Core is not configured.

## Production boundary

Production requires all of:

- `BRAVI_REWARDS_CORE_URL`: server-only Rewards Core base URL;
- `BRAVI_REWARDS_BFF_TOKEN`: server-only service credential;
- `BRAVI_WEB_SESSIONS_JSON`: temporary opaque-cookie-to-member mapping.

The temporary session map must be replaced by a real IdP-backed, HttpOnly session and durable membership before public production activation. Never prefix these values with `NEXT_PUBLIC_`.

The app exposes wallet read and disbursement planning only. It does not expose gift-card order creation, Tremendous submission, FEP recipient selection, reservations, or money movement.
