# Hosting and email preparation

Cloudflare Workers is the recommended host for this repository. The existing Nitro production build generates a Cloudflare worker and its configuration. Supabase continues to provide authentication, database access and the privileged account-management function. The browser never needs a management token or service-role key.

Render and Netlify can also host a TanStack Start application, but require the corresponding Nitro target and deployment configuration. They are alternatives, not configured deployments in this repository.

## First Cloudflare trial

1. Create/sign in to your own Cloudflare account. A custom domain is optional: use the worker's `workers.dev` address for the first trial.
2. Configure the public Supabase URL and publishable key before building (`bun run setup` on your Mac). Vite embeds these public values into the browser build.
3. In the project directory, run:

   ```bash
   bun run build
   bunx wrangler login
   bunx wrangler deploy --config .output/server/wrangler.json
   ```

   The generated configuration includes `nodejs_compat`, static assets and the current worker entry point. Do not publish `.env.local` or add privileged Supabase credentials to the frontend. No Cloudflare deployment has been performed by the assistant.

4. Copy the exact HTTPS address printed by Cloudflare. In Supabase Authentication's URL configuration, set the appropriate site URL and add that address with a trailing `/` to allowed redirects. Preserve the local addresses if Mac testing is still needed.
5. Add the same HTTPS origin, without a trailing slash, to the comma-separated `SHEPHERD_APP_ORIGINS` setting for Supabase Edge Functions. Preserve any still-needed local origins. This setting currently allows `http://localhost:3000` and `http://127.0.0.1:3000`.
6. Test the first administrator's email/password setup and MFA in their own browser, then test a volunteer account. Use the launch checklist before introducing real records.

## Resend — prepared, activation paused

The user selected Resend, then asked to leave email setup until a domain is available. No Resend account, domain, API key or paid service has been created or configured.

When ready:

1. Use a domain you control. Add and verify a sender domain in Resend using the DNS records it provides. The website can stay on `workers.dev`; an email sender domain is a separate requirement.
2. Create a Resend API key with the required sending permission. Enter it directly in Supabase's custom SMTP password field; never paste it into chat or add it to Git or a `VITE_` variable.
3. Configure Supabase custom SMTP using Resend's documented settings: host `smtp.resend.com`, port `465`, username `resend`, password the Resend API key, sender name `Shepherd`, and a sender email on the verified domain. Confirm the current provider settings in [Resend's Supabase guide](https://resend.com/docs/send-with-supabase-smtp) before saving.
4. Test delivery, spam placement, invitation acceptance, resend, expiry and password reset on the actual app address. Set an appropriate mail rate limit for the church's expected invitation volume.

Supabase's built-in email service restricts recipients and sending volume. It can be useful for limited project-owner testing, but it must not be described as ready for inviting the whole team. The app reports an email error instead of pretending an invitation was sent.

## Account endpoint

`supabase/functions/account-admin` uses native fetch and has no runtime package download. It verifies the bearer token with Supabase Auth, checks the current administrator membership and MFA through a caller-authenticated database function, and only then uses the server's service key for an invitation. Membership is granted with the caller JWT, so database checks run again. It accepts only configured origins.

Deploy this one function through the reviewed deployment process. If using the CLI, `supabase functions deploy account-admin --project-ref qcejhbyrqvzqxhufexnn --use-api --no-verify-jwt` matches the deployed configuration. The gateway JWT switch is off because verification happens explicitly in the handler; the endpoint is not anonymous. Do not remove its identity or database permission checks.
