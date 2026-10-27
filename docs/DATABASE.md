# Data model, indexes and retention

MongoDB (Atlas in production) via Mongoose. Schemas live in [`server/src/models`](../server/src/models).
Every user-owned collection has a `userId` and **every query filters by the authenticated user's id**.

## Conventions

- **Event timestamps** (`createdAt`, `updatedAt`, `loggedAt`, session times) are stored as UTC `Date`s.
- **Daily records** (`FoodLog.date`, `HydrationLog.date`, `WeightLog.date`, `NutritionGoal.effectiveFrom`)
  are `YYYY-MM-DD` strings in the user's profile time zone. They are never converted through UTC,
  so a log can't move to another day. "Today" is computed from `User.timeZone` on the server.
- **Units**: energy kcal; macros, fiber, sugars in g; sodium mg; water ml; weight kg; height cm.
- **Nutrients** are stored with full floating-point precision and rounded only for display.
  `null` means "not reported by the source", which is different from `0`.

## Collections

| Collection | Purpose | Key fields | Indexes |
| --- | --- | --- | --- |
| `users` | Account and preferences | `email` (lower-case), `passwordHash` (Argon2id, `select: false`), `emailVerifiedAt`, `timeZone`, `unitSystem`, `theme`, `meals[4]`, `notifications`, `milestones[≤20]`, `failedLoginCount`, `lockedUntil` | `email` unique |
| `sessions` | One per signed-in device | `tokenHash` (SHA-256 of refresh secret), `previousTokenHash`, `rotatedAt`, `expiresAt`, `revokedAt`, `userAgent` | `userId`; TTL on `expiresAt` (+7 days) |
| `authtokens` | Email verification / password reset | `type`, `tokenHash` (SHA-256), `expiresAt`, `usedAt` | `tokenHash` unique; TTL on `expiresAt` (+1 day) |
| `nutritiongoals` | Versioned daily targets | `effectiveFrom`, `calories`, `protein`, `carbs`, `fat`, `fiber?`, `waterMl`, `source` (`manual`/`estimate`) | `{userId, effectiveFrom}` unique |
| `foodlogs` | Diary entries | `date`, `meal`, `food` (immutable snapshot), `servingId`, `servingLabel`, `quantity`, `consumedGrams`, `nutrients` (consumed), `notes`, `clientRequestId`, `deletedAt` | `{userId, date, meal, deletedAt}`; `{userId, createdAt}`; `{userId, clientRequestId}` unique (partial); TTL on `deletedAt` (1 day, partial) |
| `foodcaches` | Shared cache of normalized public provider records (no user data) | `key` (`provider:id`), `food`, `cachedAt` | `key` unique; TTL on `cachedAt` (7 days) |
| `favorites` | Favorite foods | `provider`, `providerFoodId`, `food` snapshot | `{userId, provider, providerFoodId}` unique; `{userId, createdAt}` |
| `customfoods` | User-entered foods (values per serving) | `name`, `brand`, `servingLabel`, `servingGrams?`, `nutrients` | `userId` |
| `savedmeals` | Reusable meal templates | `items[1..30]` of `{food snapshot, servingId, quantity, grams, nutrients}` | `userId` |
| `recipes` | Recipes divided into portions | `ingredients[1..50]`, `portions`, `perPortion`, `gramsPerPortion` | `userId` |
| `hydrationlogs` | Water entries | `date`, `amountMl`, `clientRequestId?` | `{userId, date}`; `{userId, clientRequestId}` unique (partial) |
| `weightlogs` | One weight per day | `date`, `weightKg`, `note` | `{userId, date}` unique |
| `notifications` | In-app notifications | `type`, `title`, `body`, `dedupeKey`, `readAt` | `{userId, createdAt}`; `{userId, dedupeKey}` unique (partial); TTL 90 days |
| `activities` | Recent-activity feed | `type`, `message`, `date` | `{userId, createdAt}`; TTL 60 days |
| `searchhistories` | Last 15 searches per user | `query`, `lastUsedAt` | `{userId, query}` unique; `{userId, lastUsedAt}` |

Arrays embedded in documents are bounded by validation (meals 4, milestones 20, saved-meal items 30,
recipe ingredients 50). Unbounded data (entries, logs, notifications) lives in its own collection.

## Food snapshots

When a food is logged, favorited, or added to a saved meal or recipe, the server stores a complete
copy of the normalized food: name, brand, nutrient basis (per 100 g, per 100 ml, or per labelled serving),
nutrient values, serving options with gram weights, completeness, allergens, attribution and
fetch time. Editing an entry recalculates from that snapshot, so later changes at the provider never
rewrite history. Nutrition values are always computed on the server from a trusted record (cache,
provider, or the user's own custom food/recipe), never taken from the request.

## Consistency rules

- One shared function (`calculateConsumed` in `shared/src/nutrition.ts`) computes stored values;
  the client uses the same function only to preview.
- Meal, day, month and range totals all use `addToTotals`/`mergeTotals`: known values are summed and
  unknown values are counted in `missing[nutrient]`.
- Days without entries are "not logged" and excluded from averages; they are never treated as 0 kcal.
- Copy-day inserts run in a multi-document transaction where supported (Atlas, replica sets).
- Account deletion removes every user-owned collection and the user in one transaction.

## Retention

| Data | Retention |
| --- | --- |
| Deleted diary entries | Restorable for 10 minutes, physically purged ~24 h after deletion (TTL) |
| Sessions | 30 days from sign-in (absolute), purged 7 days after expiry |
| Verification / reset tokens | 24 h / 30 min validity, purged a day after expiry |
| Food cache (public data) | 7 days |
| Notifications | 90 days |
| Activity feed | 60 days |
| Everything else | Until the user deletes it or deletes their account |

No API keys, secrets or credentials are stored in MongoDB.
