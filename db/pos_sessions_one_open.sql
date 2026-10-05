-- POS sessions: close stale open sessions and stop duplicates being created.
--
-- Two problems this addresses:
--
--   1. Sessions were almost never closed — most rows have ended_at NULL, some
--      from days ago. Combined with a 24h reuse window in the app, orders placed
--      today could attach to yesterday's session, and the admin POS Sessions
--      view (which filters by started_at within a day) then hid them.
--
--   2. Session creation was check-then-insert with no constraint, so two
--      near-simultaneous page loads both inserted. 27 Aug has two sessions for
--      the same operator 0.22s apart.
--
-- Run this in the Supabase SQL Editor (project: thenookbite) before deploying.

BEGIN;

-- Close every open session except the most recent one per operator. Each is
-- closed at the time of its last order, or its start time if it never took one,
-- so the history reads sensibly rather than all ending "now".
WITH ranked AS (
  SELECT id,
         staff_id,
         started_at,
         ROW_NUMBER() OVER (PARTITION BY staff_id ORDER BY started_at DESC) AS rn
  FROM public.pos_sessions
  WHERE ended_at IS NULL
),
stale AS (
  SELECT r.id,
         GREATEST(
           r.started_at,
           COALESCE((SELECT MAX(o.created_at) FROM public.orders o WHERE o.session_id = r.id), r.started_at)
         ) AS close_at
  FROM ranked r
  WHERE r.rn > 1
)
UPDATE public.pos_sessions p
SET    ended_at = s.close_at
FROM   stale s
WHERE  p.id = s.id;

-- One open session per operator, enforced by the database rather than by a
-- read-then-write in application code that two requests can interleave on.
CREATE UNIQUE INDEX IF NOT EXISTS pos_sessions_one_open_per_staff
  ON public.pos_sessions (staff_id)
  WHERE ended_at IS NULL;

COMMIT;

-- Should show at most one open session per operator
SELECT staff_id, count(*) AS open_sessions
FROM public.pos_sessions
WHERE ended_at IS NULL
GROUP BY staff_id
ORDER BY open_sessions DESC;
