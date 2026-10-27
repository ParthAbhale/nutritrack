# NutriTrack REST API (v1)

Base path: `/api/v1`. All request/response bodies are JSON. Request schemas are the Zod
schemas exported from [`shared/src/schemas.ts`](../shared/src/schemas.ts); response types are in
[`shared/src/api.ts`](../shared/src/api.ts). Client and server import the same definitions.

## Conventions

| Topic | Rule |
| --- | --- |
| Success | `{ "data": T }`, plus `"meta": { page, pageSize, total, hasMore }` on paginated lists |
| Error | `{ "error": { code, message, details?: [{ path, message }], requestId } }` |
| Auth | HttpOnly cookies: `nt_access` (JWT, 15 min), `nt_refresh` (opaque, rotating, 30 days, path `/api/v1/auth`) |
| CSRF | Every `POST`/`PATCH`/`DELETE` needs `X-CSRF-Token` (from `GET /auth/csrf`, `/auth/me`, login, register or refresh) |
| Ownership | The user id always comes from the verified session; other users' records return `404` |
| Dates | Daily records use `YYYY-MM-DD` in the user's profile time zone; event timestamps are ISO-8601 UTC |
| Units | kcal, grams, sodium in mg, water in ml, weight in kg. `null` nutrient = not reported (never 0) |
| Idempotency | Create endpoints that log food or water accept `clientRequestId`; repeats return the original record (`200`) |
| Tracing | Every response has `X-Request-Id`; errors repeat it as `requestId` |

### Error codes

| HTTP | `code` | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Body/query/params failed validation (`details` lists fields) |
| 400 | `INVALID_TOKEN` | Reset/verification token invalid, used or expired |
| 400 | `PROVIDER_NOT_CONFIGURED` | Requested food source has no credentials |
| 401 | `UNAUTHENTICATED` / `TOKEN_EXPIRED` / `INVALID_CREDENTIALS` | Not signed in, access token expired (client refreshes), wrong login |
| 403 | `CSRF_INVALID` | Missing/invalid CSRF token |
| 404 | `NOT_FOUND` | Missing record **or** owned by someone else |
| 409 | `CONFLICT` | Duplicate (e.g. email already registered) |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 100 KB |
| 429 | `RATE_LIMITED` | Rate limit or account lockout |
| 503 | `PROVIDER_UNAVAILABLE` | Every eligible nutrition provider failed |
| 500 | `INTERNAL_ERROR` | Unexpected error (details are logged server-side only) |

## Endpoints

🔒 = requires authentication. All mutating routes require CSRF.

### Health (outside `/api/v1`)
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health/live` | Process is up |
| GET | `/health/ready` | `503` until MongoDB is connected |

### Auth
| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/auth/csrf` | – | Returns `{ csrfToken }`, sets `nt_csrf` cookie |
| POST | `/auth/register` | `name, email, password, acceptTerms, timeZone?` | `201`; signs in; sends verification email if configured (`emailSent`, `emailNotice`) |
| POST | `/auth/login` | `email, password` | Generic `401` for unknown email or wrong password; `429` after 5 failures (15 min lock) |
| POST | `/auth/logout` | – | Revokes the session, clears cookies (`204`) |
| POST | `/auth/refresh` | – | Rotates refresh token; replaying a rotated token outside a 30 s grace window revokes the session |
| GET | `/auth/me` 🔒 | – | Session restore: `{ user, csrfToken }` |
| POST | `/auth/forgot-password` | `email` | Always `202` with the same message |
| POST | `/auth/reset-password` | `token, password` | Single-use, 30-minute token; revokes all sessions |
| POST | `/auth/verify-email` | `token` | Single-use, 24-hour token |
| POST | `/auth/resend-verification` 🔒 | – | Max 5/hour |
| POST | `/auth/change-password` 🔒 | `currentPassword, newPassword` | Signs out other devices |
| GET | `/capabilities` | – | Configured providers, primary provider, email delivery flag |

### Profile & privacy 🔒
| Method | Path | Notes |
| --- | --- | --- |
| GET / PATCH | `/users/me` | `profileUpdateSchema` (strict partial) |
| GET | `/users/me/sessions` | Active devices (user agent, created/last used) |
| DELETE | `/users/me/sessions/:sessionId` | Revoke one device |
| GET | `/users/me/export` | JSON download of all personal data |
| DELETE | `/users/me` | Body `{ password, confirm: "DELETE" }`; hard-deletes every owned record |
| POST / DELETE | `/users/me/milestones[/:milestoneId]` | User-defined milestones |

### Goals 🔒
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/goals` | Goal effective today (or `null`) |
| GET | `/goals/history` | All versions, newest first |
| POST | `/goals` | Creates/replaces the version for `effectiveFrom` (default: today) |
| PATCH | `/goals/:goalId` | Edit a version |

Reports for a past date use the version effective on that date.

### Foods 🔒
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/foods/search?q&page&pageSize&source&type` | `q` ≥ 2 chars; `source=auto` uses the primary provider and falls back on failure (`warnings` explain) ; 60/min per user |
| GET | `/foods/:provider/:foodId` | Full detail incl. food-specific portions; custom/recipe ids are owner-checked |
| GET | `/foods/barcode/:barcode` | 6–14 digits; `404` when no provider knows the product |
| GET / POST | `/foods/custom` | User-entered foods (values per serving) |
| PATCH / DELETE | `/foods/custom/:foodId` | Owner only |
| GET | `/foods/recent` | Recently logged foods with last serving/quantity/meal |
| GET / POST / DELETE | `/foods/search-history` | Last 15 searches |
| GET / POST / DELETE | `/favorites[/:favoriteId]` | `POST { food: { provider, foodId } }` is idempotent |

### Diary 🔒
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/diary?date=` | `DailySummary`: meals, entries, totals (with missing counts), goal, progress, water |
| GET | `/diary/range?from&to` | Entries, max 62 days |
| POST | `/diary/entries` | `{ date, meal, food: { provider, foodId }, servingId, quantity, notes?, clientRequestId }`. Nutrition is computed server-side from a trusted food record and stored with an immutable food snapshot. |
| PATCH | `/diary/entries/:entryId` | Any of `date, meal, servingId, quantity, notes`; recalculated from the snapshot |
| DELETE | `/diary/entries/:entryId` | Soft delete (returns the entry) |
| POST | `/diary/entries/:entryId/restore` | Undo within 10 minutes |
| POST | `/diary/entries/:entryId/duplicate` | `{ date?, meal?, clientRequestId }` |
| POST | `/diary/copy-day` | `{ fromDate, toDate, entryIds?, meals?, clientRequestId }`; creates new entries in one transaction; repeats are no-ops |

### Calendar & analytics 🔒
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/calendar/month?year&month` | Per-day status (`not-logged`, `under`, `met`, `over`, `no-target`) and `PeriodStats` |
| GET | `/analytics/daily?date=` | Same as `/diary` |
| GET | `/analytics/monthly?year&month` | Same as `/calendar/month` |
| GET | `/analytics/range?from&to` | Max 366 days; per-day values incl. weight |
| GET | `/analytics/streak` | Current/longest streak, `pendingToday` |
| GET | `/activity` | Recent activity feed |
| GET | `/exports/diary.csv?from&to` | CSV, formula-injection safe |

### Saved meals & recipes 🔒
| Method | Path | Notes |
| --- | --- | --- |
| GET / POST | `/saved-meals` | Items `{ food, servingId, quantity }` (1–30) |
| PATCH / DELETE | `/saved-meals/:mealId` | |
| POST | `/saved-meals/:mealId/log` | `{ date, meal, quantities?, clientRequestId }`; overrides apply to this log only |
| GET / POST | `/recipes` | Ingredients (1–50, no nested recipes), `portions` |
| GET / PATCH / DELETE | `/recipes/:recipeId` | Log a portion via `POST /diary/entries` with `food: { provider: "recipe", foodId }` |

### Hydration & weight 🔒
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/hydration?date=` | Logs, total and goal |
| GET | `/hydration/history?from&to` | Daily totals |
| POST | `/hydration` | `{ date, amountMl, clientRequestId? }` |
| PATCH / DELETE | `/hydration/:logId` | |
| GET | `/weight?from&to` | |
| POST | `/weight` | One value per date (upsert) |
| PATCH / DELETE | `/weight/:logId` | |

### Notifications 🔒
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/notifications?page&pageSize` | `{ items, unread }` + `meta` |
| PATCH | `/notifications/:notificationId` | `{ read }` |
| POST | `/notifications/read-all` | |

## Cache invalidation (client)

After any diary mutation the client invalidates `diary`, `calendar`, `analytics`, `activity`,
`foods/recent` and `notifications` queries ([`services/diary.ts`](../client/src/services/diary.ts)).
Goal changes additionally invalidate `goals` and `hydration`. Profile changes (time zone, meal
names, week start) invalidate everything except the session.
