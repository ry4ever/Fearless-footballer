# Coaches

A coach (for example Mark) can follow the players in their squad and set
each player's training plan.

## How it works

1. **Invite.** Coach accounts are invite-only. Create a single-use code:

   ```bash
   npm run coach:invite -- "Coach's name"            # valid 30 days
   npm run coach:invite -- "Coach's name" --days 7
   ```

   This uses `DATABASE_URL` from `.env`. For the live app, run it with the
   Railway database's public URL as `DATABASE_URL`. Only a hash is stored,
   so copy the printed code straight away. (An admin can also call
   `POST /admin/coach-invites`.)

2. **Sign up.** The coach picks **Coach** on the sign-in page, then
   **New here? Create an account**, and enters the invite code. Each coach
   gets a squad code such as `SQUAD-4ZZ29G`.

3. **Join.** A player enters the squad code under **More → Your coach**.

4. **Parent approves.** The player's parent or guardian sees the request on
   their dashboard and approves or declines it. Until they approve, the
   coach sees only the player's name in a "waiting" list.

5. **Coach view.** For approved players the coach sees training progress:
   sessions completed, weeks training consistently, areas worked on, streak,
   the last 7 days and the last session. **Never** reflections, notes,
   email or date of birth.

6. **Plan.** The coach picks sessions from the library and puts them in
   order. The plan replaces the player's chosen programme: Home shows it as
   "From your coach" and today's training is its next session not yet done.

The player, the parent or the coach can end the link at any time; the plan
and the coach's access end with it.

## API

| Who | Route |
| --- | --- |
| Athlete | `GET/POST /athlete/coach`, `DELETE /athlete/coach/:linkId` |
| Parent | `GET /caregiver/coaches`, `POST /caregiver/coaches/:linkId/decision`, `DELETE /caregiver/coaches/:linkId` |
| Coach | `GET /coach/squad`, `GET /coach/athletes/:linkId`, `PUT /coach/athletes/:linkId/plan`, `DELETE /coach/athletes/:linkId` |
| Admin | `POST /admin/coach-invites` |

`GET /sessions` includes `coachPlan` when the athlete has an active coach
with a plan.

The coach dashboard is on the web app. The mobile app supports the athlete
and parent steps (joining, approving, following the plan).
