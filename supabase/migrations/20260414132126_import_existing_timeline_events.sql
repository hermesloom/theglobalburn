-- Import existing hardcoded timeline events into the database
-- Note: Events that reference burn_config fields are generated dynamically in the code
-- This migration only includes static events with fixed dates

-- Insert static events for the-borderland-2025
INSERT INTO burn_timeline_events (project_id, title, body, date, date_end)
SELECT
  p.id,
  'Burn',
  NULL,
  '2025-07-21T00:00:00Z',
  '2025-07-27T00:00:00Z'
FROM projects p
WHERE p.slug = 'the-borderland-2025';

-- Insert static events for the-borderland-2026
INSERT INTO burn_timeline_events (project_id, title, body, date, date_end)
SELECT
  p.id,
  'Annual General Meeting',
  '[See here for more info](https://talk.theborderland.se/d/Xh7k8Lov/annual-general-meeting-november-24-2025-at-20-00-8pm-)',
  '2025-11-24T19:00:00Z',
  NULL
FROM projects p
WHERE p.slug = 'the-borderland-2026';

INSERT INTO burn_timeline_events (project_id, title, body, date, date_end)
SELECT
  p.id,
  '💭 Dreams platform opens',
  'Submit your dreams to the [Dreams Platform](https://dreams.theborderland.se/borderland/dreams-2026).',
  '2026-03-12T00:00:00Z',
  NULL
FROM projects p
WHERE p.slug = 'the-borderland-2026';

INSERT INTO burn_timeline_events (project_id, title, body, date, date_end)
SELECT
  p.id,
  '📞 Community Gathering Call',
  'Whether this is your first Borderland or your tenth, whether you''re a wide-eyed newcomer or a grizzled veteran with dirt still in your boots — this Monday we''re gathering the community for a face-to-face call. Let''s remember how to Borderland together and share the most useful tips with newcomers. 🫶

See you there — bring your questions, your excitement, and maybe a snack.

Please register below – it''s very important for us to know how many virtual pancakes we need to bake for y''all!

[Register for the call](https://zoom.us/meeting/register/bEqD1VEtSnKjE9CYtGrJFg#/registration)',
  '2026-03-16T18:00:00Z',
  NULL
FROM projects p
WHERE p.slug = 'the-borderland-2026';

INSERT INTO burn_timeline_events (project_id, title, body, date, date_end)
SELECT
  p.id,
  'Spring Membership Sale closes',
  NULL,
  '2026-03-17T16:00:00Z',
  NULL
FROM projects p
WHERE p.slug = 'the-borderland-2026';

INSERT INTO burn_timeline_events (project_id, title, body, date, date_end)
SELECT
  p.id,
  '🗺️ Pre-placement kick-off meeting',
  'Pre placement is meant for large camps with special placement needs, sound camps, artworks and infrastructure realities.

**BUT:** Pre-placement allows regular camps ONLY IF you actively contribute during these four weeks to forming a neighborhood, with extra emphasis on being active. (Regular camps ~ 25 members)

Pre-placement is not meant as a shortcut to find a camp spot prior to the General placement phase, but as an option for camp placement leads to collaborate around creating a neighborhood.

If you''re a regular camp and you''re not active, we will remove you from pre-placement.

[Sign up for Pre-Placement (BL 2026)](https://forms.gle/mvjHz99bbNgHTzcL6)',
  '2026-04-07T17:00:00Z',
  NULL
FROM projects p
WHERE p.slug = 'the-borderland-2026';

INSERT INTO burn_timeline_events (project_id, title, body, date, date_end)
SELECT
  p.id,
  '💭 Deadline for uploading dreams to the platform',
  'Before the deadline, submit your dreams to the [Dreams Platform](https://dreams.theborderland.se/borderland/dreams-2026).',
  '2026-04-12T00:00:00Z',
  NULL
FROM projects p
WHERE p.slug = 'the-borderland-2026';

INSERT INTO burn_timeline_events (project_id, title, body, date, date_end)
SELECT
  p.id,
  '💭 Dreamers can edit their dreams',
  'Dreamers can edit their dreams themselves, merge dreams, adjust budgets etc: [Dreams Platform](https://dreams.theborderland.se/borderland/dreams-2026)',
  '2026-04-13T00:00:00Z',
  '2026-04-19T00:00:00Z'
FROM projects p
WHERE p.slug = 'the-borderland-2026';

INSERT INTO burn_timeline_events (project_id, title, body, date, date_end)
SELECT
  p.id,
  '💭 Dreams Committee work',
  NULL,
  '2026-04-19T00:00:00Z',
  '2026-04-23T00:00:00Z'
FROM projects p
WHERE p.slug = 'the-borderland-2026';

INSERT INTO burn_timeline_events (project_id, title, body, date, date_end)
SELECT
  p.id,
  '💭 First round of funding',
  NULL,
  '2026-04-23T00:00:00Z',
  '2026-04-26T00:00:00Z'
FROM projects p
WHERE p.slug = 'the-borderland-2026';

INSERT INTO burn_timeline_events (project_id, title, body, date, date_end)
SELECT
  p.id,
  '💭 Second round of funding',
  NULL,
  '2026-04-29T00:00:00Z',
  '2026-05-02T00:00:00Z'
FROM projects p
WHERE p.slug = 'the-borderland-2026';

INSERT INTO burn_timeline_events (project_id, title, body, date, date_end)
SELECT
  p.id,
  '💭 Third round of funding',
  NULL,
  '2026-05-05T00:00:00Z',
  '2026-05-07T00:00:00Z'
FROM projects p
WHERE p.slug = 'the-borderland-2026';

INSERT INTO burn_timeline_events (project_id, title, body, date, date_end)
SELECT
  p.id,
  '💭 Dreams Committee work',
  NULL,
  '2026-05-07T00:00:00Z',
  '2026-05-14T00:00:00Z'
FROM projects p
WHERE p.slug = 'the-borderland-2026';

INSERT INTO burn_timeline_events (project_id, title, body, date, date_end)
SELECT
  p.id,
  '💭 First round of uploads for reimbursements',
  NULL,
  '2026-05-15T00:00:00Z',
  '2026-07-05T00:00:00Z'
FROM projects p
WHERE p.slug = 'the-borderland-2026';

INSERT INTO burn_timeline_events (project_id, title, body, date, date_end)
SELECT
  p.id,
  '🗺️ General placement opens',
  NULL,
  '2026-05-22T00:00:00Z',
  NULL
FROM projects p
WHERE p.slug = 'the-borderland-2026';

INSERT INTO burn_timeline_events (project_id, title, body, date, date_end)
SELECT
  p.id,
  '🔌 Deadline for members to have their power-need figured out.',
  NULL,
  '2026-06-15T00:00:00Z',
  NULL
FROM projects p
WHERE p.slug = 'the-borderland-2026';

INSERT INTO burn_timeline_events (project_id, title, body, date, date_end)
SELECT
  p.id,
  'Spring Membership transfers close (full refund)',
  NULL,
  '2026-06-22T21:59:59Z',
  NULL
FROM projects p
WHERE p.slug = 'the-borderland-2026';

INSERT INTO burn_timeline_events (project_id, title, body, date, date_end)
SELECT
  p.id,
  '🔌 Last call for camp power setup changes',
  NULL,
  '2026-07-01T00:00:00Z',
  NULL
FROM projects p
WHERE p.slug = 'the-borderland-2026';

INSERT INTO burn_timeline_events (project_id, title, body, date, date_end)
SELECT
  p.id,
  'Burn',
  NULL,
  '2026-07-20T00:00:00Z',
  '2026-07-26T00:00:00Z'
FROM projects p
WHERE p.slug = 'the-borderland-2026';

INSERT INTO burn_timeline_events (project_id, title, body, date, date_end)
SELECT
  p.id,
  '💭 Second round of uploads for reimbursements',
  NULL,
  '2026-08-03T00:00:00Z',
  '2026-08-23T00:00:00Z'
FROM projects p
WHERE p.slug = 'the-borderland-2026';

INSERT INTO burn_timeline_events (project_id, title, body, date, date_end)
SELECT
  p.id,
  '💭 Final expense approvals and payouts',
  NULL,
  '2026-08-23T00:00:00Z',
  '2026-09-11T00:00:00Z'
FROM projects p
WHERE p.slug = 'the-borderland-2026';

INSERT INTO burn_timeline_events (project_id, title, body, date, date_end)
SELECT
  p.id,
  '💭 Committee work for unforeseen expenses',
  'Committee work for unforeseen expenses IF there is a surplus.',
  '2026-09-11T00:00:00Z',
  '2026-09-15T00:00:00Z'
FROM projects p
WHERE p.slug = 'the-borderland-2026';
