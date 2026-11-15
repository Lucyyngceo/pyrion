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

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        # Overwrite, never append: the client cannot inject its own value.
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $remote_addr;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

and the app is started with:

```bash
PYRION_TRUST_PROXY=1 NODE_ENV=production npm --prefix web run start -- -H 127.0.0.1 -p 3000
```

Without `PYRION_TRUST_PROXY=1` the app ignores every client-supplied address header and all callers share one hourly bucket. That is safe (no one can create fresh allowances by forging headers) but it would let a single heavy user use up the hour for everyone, so production must set it. The app logs an error at startup in production when it is missing, and `GET /api/llm/health` reports `visitor_isolation`.

## Secrets

Keys live only in the server environment (`web/.env.local`, mode 600, owned by the service user). They are never committed, never sent to the browser and never logged. Required variables are listed in `web/.env.example`.

## Spend

- The paid provider is prepaid with no automatic top-up: the balance is the hard ceiling.
- In-app limits: a per-visitor hourly limit, a per-visitor limit on the paid provider, and a daily cap on the paid provider stored on disk (`web/.data/`, survives restarts).
- When the paid provider is out of balance or down, the router uses the free fallback (NVIDIA NIM); when both are unavailable the app keeps working in structured mode (every verdict, no chat).

## Availability

The link must stay up until the Space Apps winners are announced (January 26, 2027). The process runs under a supervisor that restarts it on failure, and an external check alerts if `GET /api/llm/health` stops answering.
