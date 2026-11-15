# Deploying PYRION

How the public instance at `pyrion.us` is run. Everything here can be reproduced on any Linux host with Node 24 and nginx.

## Layout

```
Internet ──HTTPS──> nginx (:443) ──HTTP──> Next.js (127.0.0.1:3000)
```

- **Next.js listens on 127.0.0.1 only.** It is never reachable from the Internet directly, so no client can talk to it without passing through nginx.
- **nginx terminates HTTPS** and sets the client address itself.

## Visitor identity and rate limits

PYRION limits language-model questions per visitor. The visitor is identified by a hash of the client IP address (nothing identifying is stored). The IP is trusted **only** when it comes from our own nginx:

```nginx
server {
    listen 443 ssl;
    server_name pyrion.us www.pyrion.us;
    # ssl_certificate … (certbot)
    # Questions are under 500 characters; nothing legitimate needs a large body.
    client_max_body_size 16k;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        # Overwrite, never append: the client cannot inject its own value.
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $remote_addr;
        proxy_set_header   X-Forwarded-Proto $scheme;
        # Proves the request came through this nginx (same value as PYRION_PROXY_SECRET).
        proxy_set_header   X-Pyrion-Proxy    "<long random value>";
        proxy_read_timeout 60s;
    }
}
```

and the app is started with:

```bash
PYRION_TRUST_PROXY=1 PYRION_PROXY_SECRET="<same long random value>" NODE_ENV=production npm --prefix web run start -- -H 127.0.0.1 -p 3000
```

The client address is trusted only when both hold: `PYRION_TRUST_PROXY=1` and the request carries `X-Pyrion-Proxy` equal to `PYRION_PROXY_SECRET`. If Node were ever reachable directly, a forged `X-Real-IP` without the secret is ignored. The secret lives only in the nginx config and the server environment (generate it with `openssl rand -hex 32`); it is never committed. The app also refuses request bodies larger than 8 KB on its own.

Without `PYRION_TRUST_PROXY=1` the app ignores every client-supplied address header and all callers share one hourly bucket. That is safe (no one can create fresh allowances by forging headers) but it would let a single heavy user use up the hour for everyone, so production must set it. The app logs an error at startup in production when it is missing, and `GET /api/llm/health` reports `visitor_isolation`.

## Secrets

Keys live only in the server environment (`web/.env.local`, mode 600, owned by the service user). They are never committed, never sent to the browser and never logged. Required variables are listed in `web/.env.example`.

## Spend

- The paid provider is prepaid with no automatic top-up: the balance is the hard ceiling.
- In-app limits: a per-visitor hourly limit, a per-visitor limit on the paid provider, and a daily cap on the paid provider stored on disk (`web/.data/`, survives restarts).
- When the paid provider is out of balance or down, the router uses the free fallback (NVIDIA NIM); when both are unavailable the app keeps working in structured mode (every verdict, no chat).

## Steps (checked from a clean clone)

A fresh `git clone` builds and passes its tests as is (`cd web && npm ci && npm run build && npm test`; tests that need `data/raw/` or the private challenge copy are skipped, not failed). Two things are not in the repository and must be added on the server:

1. **The TARS library** (`web/.data/corpus/`, about 65 MB). It is regenerated from the NASA files in `data/raw/`, which are not published here (they are downloaded from PSI and NTRS; see `data/README.md`). Build it where `data/raw/` exists and copy the folder:

   ```bash
   python -I tools/build_corpus.py
   rsync -a web/.data/corpus/ <server>:<app>/web/.data/corpus/
   ```

   Without it the site still works and the chat answers without the NASA layer (no quoted NASA pages); the server log says "NASA library not available".
2. **The keys** in `web/.env.local` (see Secrets), and the two proxy variables above.

Then:

```bash
cd web && npm ci && npm run build
PYRION_TRUST_PROXY=1 PYRION_PROXY_SECRET="<same long random value>" NODE_ENV=production npm run start -- -H 127.0.0.1 -p 3000
curl -s http://127.0.0.1:3000/api/llm/health   # visitor_isolation must be on
```

Node: `web/README.md` asks for 20.9 or newer; the public instance runs Node 24.

## Availability

The link must stay up until the Space Apps winners are announced (January 26, 2027). The process runs under a supervisor that restarts it on failure, and an external check alerts if `GET /api/llm/health` stops answering.

## Security headers

The app sends its own security headers on every response (`web/next.config.ts`, `headers()`): Content-Security-Policy with
`frame-ancestors 'none'`, Strict-Transport-Security, `X-Content-Type-Options: nosniff`, Referrer-Policy, X-Frame-Options and
Permissions-Policy. nginx should not duplicate them. In the `http {}` block of nginx, also set:

```nginx
server_tokens off;   # do not reveal the nginx version in headers and error pages
```
