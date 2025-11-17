# The Global Burn

Hosting a burn for everybody.

Initially for [The Borderland](https://theborderland.se), but designed to be as general, configurable and parameterizable as possible.

## TODO

- allow changing name and birthday (only admins can change)
  - users can *apply* for a change of name and/or birthday, auto-accept with small Levenshtein distance
- allow search for memberships (both email and name)
- generate and send out membership QR PDF via email
- link list (both on theborderland.se and in another section besides the timeline overview)
- membership scanner

## Long-term goals

- consolidating existing tools
  - add the entire dreams system (including receipt submission), i.e. everything what Cobudget and Open Collective currently do
  - add a single interface for all shift signups (clowns, sanctuary, threshold, toilets, etc.)
    - issue so far: realities leads didn't have proper contact details from everyone!
  - add a single interface for rideshares
  - integrate the map and the JOMO guide, i.e. everything what the [Dust app](https://dust.events/) currently does
  - integrate everything Talk currently does
  - add LLM-based AP writing assistance (based on the AP [How do we run Advice Processes?](https://talk.theborderland.se/d/iFKC1rD2/how-do-we-run-advice-processes-))
  - add all the functionality for [BurnerBox](https://burnerbox.glide.page/dl/search)
- technical
  - set up as a Progressive Web App (PWA) to allow seamless use on mobile
  - allow "one-click deployment" onto own server, e.g. using [Fly](https://fly.io/)
  - i18n

## Recap 2025 and infrastructure vision

It also bothered me that Vercel and/or the Supabase Postgres database struggled even for this tiny amount of time... That's my ambitious 100% uptime brain, more as a pretty exciting infrastructural challenge :D Also Vercel and Supabase are of course still regular commercial companies, while it would be sooo great to have a 100% burner-managed stack.

For next year my dream is to have something like self-hosted Vercel, but instead of one party managing a big data center, we would be massively decentralized, so that everyone can voluntarily "donate" servers, and then those servers would act like one big unified edge network (like https://vercel.com/docs/edge-network/overview) which can serve anything from any Docker container. Also a bit like https://fly.io/

## Setup instructions

1. Make sure that you have recent versions of Node.js and Docker installed
2. Clone this repositorys
3. Run `npm install`
4. Run `npm run supabase:start`
5. Copy the contents from .env.template to .env and use the keys from the output of the previous command to populate the file. If you are running on somewhere else than localhost update the URLs as well. 
6. Run `npm run dev`
7. Go to http://localhost:3000
8. Click on "Click to login", enter any email address and click on "Send magic link"
9. Go to http://localhost:54324/monitor and click on the first entry
10. Copy the 6-digit code from that email into your login tab and submit it
11. Go to http://localhost:54323/project/default/editor and click on "profiles" on the left
12. Set "is_admin" to TRUE for your user
13. Reload your tab with http://localhost:3000/
14. Click on the gear icon titled "Administration" in the top left
15. Click on "Projects" to reach http://localhost:3000/admin/projects
16. Click on "Add project" and enter the following
    - Name: `The Borderland 2025`
    - Type: `burn`
    - Slug: `the-borderland-2025` (determined automatically)
17. Click on "Submit"
18. Click on "The Borderland 2025" in the left bar to reach http://localhost:3000/burn/the-borderland-2025
19. Click on "Configuration" and scroll to the bottom to reach http://localhost:3000/burn/the-borderland-2025/admin/config
20. Go to https://dashboard.stripe.com/test/apikeys, copy out the secret key (starting with `sk_test_`) and copy it into the `stripe_secret_api_key` field of the burn config. You will need a stripe account in advance for this. 
21. Make sure you have the stripe command line tools installed. If you do not have these installed (you can test by typing in stripe in your command line) find instructions here: https://docs.stripe.com/stripe-cli
22. Run `npm run stripe:listen` in a separate console. Follow the instructions on activating the keys. Once done run the command again, copy out the webhook signing secret (starting with `whsec_`) and copy it into the `stripe_webhook_secret` of the burn config
23. Click on "Save configuration"

## Metrics Endpoint

The platform exposes Prometheus metrics at `/api/metrics`. The endpoint is protected by Bearer token or Basic authentication using the `GRAFANA_API_KEY` environment variable.

To access the metrics endpoint using cURL while reading the API key from `.env`:

**Bearer token authentication:**
```bash
curl -H "Authorization: Bearer $(grep GRAFANA_API_KEY .env | cut -d '=' -f2)" http://localhost:3000/api/metrics
```

**Basic authentication (username: "user", password: GRAFANA_API_KEY):**
```bash
curl -u "user:$(grep GRAFANA_API_KEY .env | cut -d '=' -f2)" http://localhost:3000/api/metrics
```

For production, replace `http://localhost:3000` with your production URL.

## Co-creation

Please contact synergies@hermesloom.org for collaboration and co-creation.

## License

[GNU GPL v3 or later](https://spdx.org/licenses/GPL-3.0-or-later.html)
