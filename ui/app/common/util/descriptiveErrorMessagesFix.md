## Background

In **Bahmni 0.93 (Vagrant)** setup, the Apache proxy passes the OpenMRS error response as-is back to the browser. So the Angular UI/app/common/util/httpErrorInterceptor.js receives `response.data.error.message` with the detailed error (e.g., `"unknown table 'x' in field list"`).

In **Bahmni 1.0 (Docker)** setup, the `bahmni-proxy` has `ProxyErrorOverride` on **500 501 502**. This tells Apache to intercept any **500/501/502** response from OpenMRS and replace the body with `/internalError.html` — a static HTML page. So `response.data` is now HTML, not JSON. The interceptor can’t find `data.error.message`, and falls back to the generic message: **"There was an unexpected issue on the server. Please try again"**.

This was a deliberate security decision to avoid leaking stack traces to end users. It is essential to take all possible measures to prevent the server from returning stack traces, state dumps, etc., to the client for security reasons.

> **Notice:** Try this out on a test server.

---

## Steps

1. **Backup everything \***
   - clinical
   - lab
   - odoo
   - everything you could get your hands on

2. **Exec into**:
   - `bahmni-standard-proxy-1`

3. **Open**:
   - `/usr/local/apache2/conf/bahmni-proxy.conf`

4. **Find and comment out** these two lines:
   - `ProxyErrorOverride on 500 501 502`
   - `ErrorDocument 500 /internalError.html`

5. **Exec out of** `bahmni-standard-proxy-1`

6. **From your host**, copy the updated proxy config file:
   ```bash
   docker cp bahmni-standard-proxy-1:/usr/local/apache2/conf/bahmni-proxy.conf ./bahmni-proxy.conf

7. **From your host**, restart proxy:
   ```bash
   docker compose restart proxy
   
   After this, your browser will receive the actual JSON error responses from OpenMRS with detailed messages like you get in the 0.93 Vagrant setup.
   