import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ALLERGEN_DISCLAIMER } from '@nutritrack/shared';
import { Logo } from '@/components/layout/Logo';
import { Card } from '@/components/ui/card';

function LegalLayout({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-page px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link to="/" aria-label="NutriTrack home"><Logo /></Link>
          <Link to="/" className="inline-flex items-center gap-1 text-sm font-medium text-primary"><ArrowLeft className="size-4" /> Back</Link>
        </div>
        <Card className="p-6 sm:p-10">
          <main>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
            <p className="mt-1 text-[13px] text-muted">Last updated {updated}</p>
            <div className="mt-6 space-y-6 text-[14px] leading-relaxed text-ink [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_li]:text-muted [&_p]:text-muted [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
              {children}
            </div>
          </main>
        </Card>
        <p className="mt-6 text-center text-[12px] text-subtle">
          <Link to="/privacy" className="hover:text-ink">Privacy</Link> · <Link to="/terms" className="hover:text-ink">Terms</Link>
        </p>
      </div>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy notice" updated="27 October 2026">
      <p>
        NutriTrack is a student project. This notice explains, in plain language, what the app stores about you, why, and what control you
        have. Your data is not sold, used for advertising, or shown to other users.
      </p>
      <section>
        <h2>What we store and why</h2>
        <ul>
          <li><strong className="text-ink">Account:</strong> your name, email address, and a salted Argon2id hash of your password (never the password itself), to sign you in.</li>
          <li><strong className="text-ink">Profile:</strong> height, optional date of birth and sex, activity level, units, time zone, meal schedule and dietary preferences, to personalise estimates, dates and views.</li>
          <li><strong className="text-ink">Food diary:</strong> each entry with its date, meal, serving and a snapshot of the food's nutrition at the time you logged it.</li>
          <li><strong className="text-ink">Goals, water and weight:</strong> your targets (with the date each applies from) and your tracking logs.</li>
          <li><strong className="text-ink">Recipes, saved meals, custom foods and favorites</strong> you create.</li>
          <li><strong className="text-ink">Notifications and recent activity</strong> shown inside the app.</li>
          <li><strong className="text-ink">Sessions:</strong> one record per signed-in device with the browser's user-agent string and a hashed refresh token, so you can see and sign out devices.</li>
        </ul>
      </section>
      <section>
        <h2>Cookies</h2>
        <p>NutriTrack uses only cookies that are necessary for signing in and security. There are no analytics or advertising cookies.</p>
        <ul>
          <li><code>nt_access</code>: a short-lived (about 15 minutes) signed token that proves you are signed in. HttpOnly, so page scripts can't read it.</li>
          <li><code>nt_refresh</code>: a longer-lived token used only to renew your sign-in. It changes every time it is used, and only a hash is stored on the server. HttpOnly.</li>
          <li><code>nt_csrf</code>: a random value used to protect against cross-site request forgery. HttpOnly.</li>
        </ul>
        <p>Your theme choice is also remembered in your browser's local storage so pages don't flash on load.</p>
      </section>
      <section>
        <h2>Third-party nutrition data</h2>
        <p>
          When you search, your search words (never your identity) are sent from our server to whichever food databases are configured:
          USDA FoodData Central (U.S. public-domain data), Open Food Facts (Open Database License, data © Open Food Facts contributors), and
          Nutritionix (under Nutritionix's API terms). Product images may load directly from Open Food Facts or Nutritionix servers. Each food
          shows which source it came from.
        </p>
      </section>
      <section>
        <h2>Retention</h2>
        <ul>
          <li>Diary entries you delete can be restored for a short time, and are permanently removed after 24 hours.</li>
          <li>Notifications are kept for 90 days; the recent-activity feed for 60 days.</li>
          <li>Sessions end when you sign out and expire 30 days after you sign in; expired session records are purged a week later.</li>
          <li>Password-reset and verification links expire (30 minutes and 24 hours) and work once.</li>
          <li>Everything else is kept until you delete it or delete your account.</li>
        </ul>
      </section>
      <section>
        <h2>Your controls</h2>
        <ul>
          <li>Export all of your data as JSON, or your diary as CSV, from Settings → Privacy &amp; data and Reports.</li>
          <li>Edit your profile and preferences at any time.</li>
          <li>Delete your account: this permanently removes your account and every record linked to it. Database backups maintained by the hosting provider expire according to its backup schedule.</li>
        </ul>
      </section>
      <section>
        <h2>Health information</h2>
        <p>Nutrition values, estimates and allergen warnings are informational and not medical advice. {ALLERGEN_DISCLAIMER}</p>
      </section>
    </LegalLayout>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms of use" updated="27 October 2026">
      <p>These terms apply to your use of NutriTrack, a student project provided as-is for learning and personal tracking.</p>
      <section>
        <h2>Your account</h2>
        <ul>
          <li>Keep your password private. You are responsible for activity on your account.</li>
          <li>Provide accurate information, and don't try to access other people's data or disrupt the service.</li>
          <li>NutriTrack is intended for people aged 13 and over.</li>
        </ul>
      </section>
      <section>
        <h2>Not medical advice</h2>
        <p>
          NutriTrack does not diagnose, treat or give medical or dietary advice. Calorie and macro suggestions are approximate estimates from
          population formulas. Talk to a qualified professional before making significant changes to your diet, especially if you are pregnant,
          have a medical condition, or have a history of disordered eating.
        </p>
      </section>
      <section>
        <h2>Food data</h2>
        <p>
          Food and nutrition information comes from third-party databases (USDA FoodData Central, Open Food Facts, Nutritionix) and from what
          you enter yourself. It may be incomplete, out of date or wrong; missing values are shown as missing rather than zero.{' '}
          {ALLERGEN_DISCLAIMER} Open Food Facts data is available under the Open Database License; Nutritionix data is subject to Nutritionix's terms.
        </p>
      </section>
      <section>
        <h2>Availability</h2>
        <p>
          The service may change, be unavailable, or stop at any time, and external food databases may be temporarily unreachable. Export your
          data regularly if it matters to you.
        </p>
      </section>
      <section>
        <h2>Ending use</h2>
        <p>You can delete your account at any time from Settings. Accounts used to abuse the service may be suspended.</p>
      </section>
    </LegalLayout>
  );
}
