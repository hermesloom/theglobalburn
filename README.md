# The Global Burn

Hosting a burn for everybody.

Initially for [The Borderland](https://theborderland.se), but designed to be as general, configurable and parameterizable as possible.

## TODO

- add all questions for burner questionnaire (to be provided by Wanda)
- allow adding children (just as membership metadata, i.e. not a "real" membership, children don't need QR codes)
- allow changing name and birthday (only admins can change)
  - users can *apply* for a change of name and/or birthday, auto-accept with small Levenshtein distance
- allow search for memberships (both email and name)
- when transfers are closed, also say that instead of hiding the section
- when refunding a membership, deduct Stripe fees
- allow simply giving back membership (deadline equals transfer deadline)
- add warning for membership transfer ("WARNING: it will be gone!")
- email notifications (via existing Mailgun), only for successful payment (generate and send out membership QR PDF)
- link list (both on theborderland.se and in another section besides the timeline overview)
- membership scanner
- make fully mobile-ready
- load testing
- host what was previously on borderland.pro on theborderland.se
  - set up Cloudflare redirect from borderland.pro to theborderland.se

## Long-term goals

- consolidating existing tools
  - add the entire dreams system (including receipt submission), i.e. everything what Cobudget and Open Collective currently do
  - add a single interface for all shift signups (clowns, sanctuary, threshold, toilets, etc.)
    - issue so far: realities leads didn't have proper contact details from everyone!
  - add a single interface for rideshares
  - integrate the map and the JOMO guide, i.e. everything what the [Dust app](https://dust.events/) currently does
  - integrate everything Talk currently does
  - add LLM-based AP writing assistance (based on the AP "How to run an AP", which will be published by Rosa soon)
  - add all the functionality for [BurnerBox](https://burnerbox.glide.page/dl/search)
- technical
  - set up as a Progressive Web App (PWA) to allow seamless use on mobile
  - allow "one-click deployment" onto own server, e.g. using [Fly](https://fly.io/)
  - i18n

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

## Co-creation

Please contact synergies@hermesloom.org for collaboration and co-creation.

## License

[GNU GPL v3 or later](https://spdx.org/licenses/GPL-3.0-or-later.html)
