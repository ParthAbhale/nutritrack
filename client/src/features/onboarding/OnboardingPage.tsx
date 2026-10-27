import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Info, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  ACTIVITY_LABELS, ALLERGENS, ALLERGEN_DISCLAIMER, DIETARY_PREFERENCES, ageFromDateOfBirth, estimateEnergyNeeds, goalInputSchema,
  isValidDateString, isValidTimeZone, todayInTimeZone, type ActivityLevel, type MealSetting, type NotificationPrefs, type UserProfile, type WeightGoal,
} from '@nutritrack/shared';
import { useCurrentUser } from '@/services/auth';
import { useUpdateProfile } from '@/services/users';
import { useSaveGoal } from '@/services/goals';
import { useWeightMutations } from '@/services/tracking';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/layout/Logo';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/ui/confirm';
import { InlineError, Notice } from '@/components/feedback/states';
import {
  ALLERGEN_LABELS, ChipMultiSelect, DIET_LABELS, HeightInput, MealScheduleEditor, SEX_OPTIONS, TimeZoneSelect, WeightInput, fromKg, parseExcluded, toKg,
} from '@/features/settings/preferenceControls';

const STEPS = ['Basic profile', 'Nutrition goals', 'Preferences'] as const;
type Errors = Record<string, string>;
type Diet = (typeof DIETARY_PREFERENCES)[number];
type Allergen = (typeof ALLERGENS)[number];

interface GoalFields {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  waterMl: string;
}

/**
 * Three-step onboarding. All inputs live in this component's state, so a
 * failed save never discards what the user entered. Saving is idempotent
 * (profile PATCH, goal upsert by date, weight upsert by date), so a retry is safe.
 */
export default function OnboardingPage() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const updateProfile = useUpdateProfile();
  const saveGoal = useSaveGoal();
  const { upsert: saveWeight } = useWeightMutations();

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const busy = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Step 1
  const [name, setName] = useState(user.name);
  const [dob, setDob] = useState(user.dateOfBirth ?? '');
  const [sex, setSex] = useState<UserProfile['sex']>(user.sex);
  const [units, setUnits] = useState<UserProfile['unitSystem']>(user.unitSystem);
  const [heightCm, setHeightCm] = useState(user.heightCm ? String(user.heightCm) : '');
  const [weight, setWeight] = useState('');
  // Step 2
  const [weightGoal, setWeightGoal] = useState<WeightGoal>(user.weightGoal ?? 'maintain');
  const [activity, setActivity] = useState<ActivityLevel>(user.activityLevel ?? 'light');
  const [targetWeight, setTargetWeight] = useState(fromKg(user.targetWeightKg, user.unitSystem));
  const [goals, setGoals] = useState<GoalFields | null>(null);
  // Step 3
  const [diet, setDiet] = useState(user.dietaryPreferences as Diet[]);
  const [allergens, setAllergens] = useState(user.allergens as Allergen[]);
  const [excluded, setExcluded] = useState(user.excludedFoods.join(', '));
  const [meals, setMeals] = useState<MealSetting[]>(user.meals);
  const [timeZone, setTimeZone] = useState(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return user.timeZone !== 'UTC' ? user.timeZone : detected || 'UTC';
  });
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(user.weekStartsOn);
  const [notifications, setNotifications] = useState<NotificationPrefs>(user.notifications);

  const today = todayInTimeZone(isValidTimeZone(timeZone) ? timeZone : 'UTC');
  const weightKg = toKg(weight, units);
  const age = dob && isValidDateString(dob) ? ageFromDateOfBirth(dob, today) : null;

  const estimate = useMemo(() => {
    const h = Number(heightCm);
    if (!weightKg || !(h > 0)) return null;
    return estimateEnergyNeeds({ weightKg, heightCm: h, ageYears: age, sex, activityLevel: activity, goal: weightGoal });
  }, [weightKg, heightCm, age, sex, activity, weightGoal]);

  const estimateFields: GoalFields | null = estimate
    ? { calories: String(estimate.suggestedCalories), protein: String(estimate.protein), carbs: String(estimate.carbs), fat: String(estimate.fat), waterMl: String(estimate.waterMl) }
    : null;

  // Keep the editable fields in sync with the estimate until the user edits them.
  const goalsEdited = useRef(false);
  useEffect(() => {
    if (estimateFields && !goalsEdited.current) setGoals(estimateFields);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateFields?.calories, estimateFields?.protein, estimateFields?.carbs, estimateFields?.fat, estimateFields?.waterMl]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const changeUnits = (next: UserProfile['unitSystem']) => {
    // Convert displayed weights so the underlying kilograms stay the same.
    setWeight((w) => fromKg(toKg(w, units), next));
    setTargetWeight((w) => fromKg(toKg(w, units), next));
    setUnits(next);
  };

  const validateStep = (s: number): Errors => {
    const e: Errors = {};
    if (s === 0) {
      if (!name.trim()) e.name = 'Enter your name';
      if (dob) {
        if (!isValidDateString(dob) || dob > today) e.dob = 'Enter a valid date in the past';
        else if (age !== null && age < 13) e.dob = 'NutriTrack is intended for people aged 13 and over';
      }
      const h = Number(heightCm);
      if (!heightCm || !(h >= 50 && h <= 272)) e.height = 'Enter a height between 50 and 272 cm (1′8″–8′11″)';
      if (weightKg === null || weightKg < 20 || weightKg > 400) e.weight = units === 'metric' ? 'Enter a weight between 20 and 400 kg' : 'Enter a weight between 44 and 880 lb';
    }
    if (s === 1) {
      if (targetWeight.trim()) {
        const t = toKg(targetWeight, units);
        if (t === null || t < 20 || t > 400) e.targetWeight = 'Enter a realistic target weight or leave it empty';
      }
      const parsed = goalInputSchema.safeParse(goalPayload());
      if (!parsed.success) for (const issue of parsed.error.issues) e[String(issue.path[0])] ??= issue.message;
    }
    if (s === 2) {
      if (!isValidTimeZone(timeZone)) e.timeZone = 'Choose a valid time zone';
      if (meals.some((m) => !m.name.trim())) e.meals = 'Every meal needs a name';
    }
    return e;
  };

  function goalPayload() {
    const g = goals ?? { calories: '', protein: '', carbs: '', fat: '', waterMl: '' };
    return { calories: Number(g.calories), protein: Number(g.protein), carbs: Number(g.carbs), fat: Number(g.fat), waterMl: Number(g.waterMl) };
  }

  const next = () => {
    const e = validateStep(step);
    setErrors(e);
    if (Object.keys(e).length) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const profilePayload = () => ({
    name: name.trim(),
    dateOfBirth: dob || null,
    sex,
    heightCm: Number(heightCm),
    unitSystem: units,
    timeZone,
    weekStartsOn,
    activityLevel: activity,
    weightGoal,
    targetWeightKg: targetWeight.trim() ? toKg(targetWeight, units) : null,
    dietaryPreferences: diet,
    allergens,
    excludedFoods: parseExcluded(excluded),
    meals: meals.map((m) => ({ ...m, name: m.name.trim() })),
    notifications,
  });

  const finish = async () => {
    const e = validateStep(2);
    setErrors(e);
    if (Object.keys(e).length || busy.current) return;
    busy.current = true;
    setSaving(true);
    setSubmitError(null);
    try {
      await updateProfile.mutateAsync(profilePayload());
      const payload = goalPayload();
      const unchanged = estimateFields && (Object.keys(payload) as (keyof GoalFields)[]).every((k) => String(payload[k]) === estimateFields[k]);
      await saveGoal.mutateAsync({ ...payload, effectiveFrom: today, source: unchanged ? 'estimate' : 'manual' });
      if (weightKg) await saveWeight.mutateAsync({ date: today, weightKg: Math.round(weightKg * 100) / 100 });
      await updateProfile.mutateAsync({ onboardingCompleted: true });
      toast.success('Your profile is ready');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setSubmitError(`${errorMessage(err)} Your answers are kept; you can try again.`);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  const skip = async () => {
    try {
      await updateProfile.mutateAsync({ onboardingCompleted: true, timeZone: isValidTimeZone(timeZone) ? timeZone : 'UTC' });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const setGoalField = (k: keyof GoalFields, v: string) => {
    goalsEdited.current = true;
    setGoals((g) => ({ ...(g ?? { calories: '', protein: '', carbs: '', fat: '', waterMl: '' }), [k]: v }));
  };

  return (
    <div className="min-h-dvh bg-page px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Logo />
          <Button variant="ghost" size="sm" onClick={() => setSkipOpen(true)} disabled={saving}>Skip for now</Button>
        </div>

        <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="Onboarding progress">
          {STEPS.map((label, i) => (
            <li key={label} aria-current={i === step ? 'step' : undefined} className="min-w-0">
              <div className={cn('h-1.5 rounded-full', i <= step ? 'bg-primary' : 'bg-line')} />
              <p className={cn('mt-2 flex items-center gap-1 truncate text-[12px] font-medium', i === step ? 'text-primary' : i < step ? 'text-ink' : 'text-subtle')}>
                {i < step && <Check className="size-3.5 shrink-0" aria-hidden />}
                <span className="truncate">
                  <span className="sr-only">Step {i + 1} of {STEPS.length}: </span>
                  {label}
                  {i < step && <span className="sr-only"> (completed)</span>}
                </span>
              </p>
            </li>
          ))}
        </ol>

        <Card className="p-5 sm:p-8">
          <h1 ref={headingRef} tabIndex={-1} className="text-xl font-semibold tracking-tight text-ink outline-none">
            {step === 0 && `Welcome, ${user.name.split(' ')[0]}. Tell us about you`}
            {step === 1 && 'Set your daily targets'}
            {step === 2 && 'Your preferences'}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {step === 0 && 'Used only to estimate starting targets. Optional fields can stay empty, and you can change everything later in Settings.'}
            {step === 1 && 'Start from an estimate and adjust it to whatever works for you.'}
            {step === 2 && 'Help NutriTrack fit your routine. All of these are optional.'}
          </p>

          <form
            className="mt-6 space-y-5"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (step < STEPS.length - 1) next();
              else void finish();
            }}
          >
            {step === 0 && (
              <>
                <Field label="Display name" error={errors.name}>
                  {(p) => <Input {...p} autoComplete="name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />}
                </Field>
                <fieldset>
                  <legend className="text-[13px] font-medium text-ink">Units</legend>
                  <Segmented
                    name="units"
                    value={units}
                    onChange={(v) => changeUnits(v as UserProfile['unitSystem'])}
                    options={[{ value: 'metric', label: 'Metric (cm, kg, ml)' }, { value: 'imperial', label: 'Imperial (ft, lb, fl oz)' }]}
                  />
                </fieldset>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Height" error={errors.height}>
                    {(p) => <HeightInput key={units} {...p} units={units} cm={heightCm} onChange={setHeightCm} />}
                  </Field>
                  <Field label="Current weight" error={errors.weight}>
                    {(p) => <WeightInput {...p} units={units} value={weight} onChange={setWeight} />}
                  </Field>
                  <Field label="Date of birth" optional error={errors.dob} hint="Improves the estimate; never shown to anyone.">
                    {(p) => <Input {...p} type="date" max={today} value={dob} onChange={(e) => setDob(e.target.value)} />}
                  </Field>
                  <Field label="Sex for energy estimates" optional hint="The estimate formula differs slightly by sex.">
                    {(p) => (
                      <Select {...p} value={sex} onChange={(e) => setSex(e.target.value as UserProfile['sex'])}>
                        {SEX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </Select>
                    )}
                  </Field>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <fieldset>
                  <legend className="text-[13px] font-medium text-ink">Goal</legend>
                  <Segmented
                    name="goal"
                    value={weightGoal}
                    onChange={(v) => setWeightGoal(v as WeightGoal)}
                    options={[{ value: 'lose', label: 'Lose weight' }, { value: 'maintain', label: 'Maintain' }, { value: 'gain', label: 'Gain weight' }]}
                  />
                </fieldset>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Activity level">
                    {(p) => (
                      <Select {...p} value={activity} onChange={(e) => setActivity(e.target.value as ActivityLevel)}>
                        {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((k) => <option key={k} value={k}>{ACTIVITY_LABELS[k]}</option>)}
                      </Select>
                    )}
                  </Field>
                  <Field label="Target weight" optional error={errors.targetWeight}>
                    {(p) => <WeightInput {...p} units={units} value={targetWeight} onChange={setTargetWeight} />}
                  </Field>
                </div>

                {estimate && (
                  <section aria-labelledby="estimate-heading" className="rounded-[var(--radius-card)] border border-line bg-surface-2 p-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-primary" aria-hidden />
                      <h2 id="estimate-heading" className="text-sm font-semibold text-ink">Estimate</h2>
                      <span className="rounded-full bg-soft px-2 py-0.5 text-[11px] font-medium text-primary">Approximate</span>
                    </div>
                    <p className="mt-2 text-[13px] text-muted">
                      Estimated maintenance: <strong className="tabular text-ink">{estimate.maintenanceCalories} kcal/day</strong>. Suggested starting target:{' '}
                      <strong className="tabular text-ink">{estimate.suggestedCalories} kcal/day</strong> (Mifflin–St Jeor formula × activity factor).
                    </p>
                    {estimate.notes.length > 0 && (
                      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[12px] text-muted">
                        {estimate.notes.map((n) => <li key={n}>{n}</li>)}
                      </ul>
                    )}
                    {goals && estimateFields && goalsEdited.current && (
                      <Button variant="link" size="sm" className="mt-1" onClick={() => { goalsEdited.current = false; setGoals(estimateFields); }}>
                        Reset targets to the estimate
                      </Button>
                    )}
                  </section>
                )}
                <Notice icon={Info}>
                  Estimates come from population formulas and can be off for many people. They never suggest extreme deficits (at most 500 kcal below maintenance, and not below 1500 kcal). This is not medical advice; speak to a health professional about specific needs.
                </Notice>

                <fieldset>
                  <legend className="text-[13px] font-medium text-ink">Your daily targets</legend>
                  <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {([['calories', 'Calories', 'kcal'], ['protein', 'Protein', 'g'], ['carbs', 'Carbs', 'g'], ['fat', 'Fat', 'g'], ['waterMl', 'Water', 'ml']] as const).map(([k, label, unit]) => (
                      <Field key={k} label={label} error={errors[k]} className={k === 'calories' ? 'col-span-2 sm:col-span-1' : undefined}>
                        {(p) => (
                          <div className="relative">
                            <Input {...p} inputMode="numeric" value={goals?.[k] ?? ''} onChange={(e) => setGoalField(k, e.target.value)} className="pr-10" />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted">{unit}</span>
                          </div>
                        )}
                      </Field>
                    ))}
                  </div>
                  <p className="mt-2 text-[12px] text-muted">Your entries are saved as your targets; the estimate is only a starting point.</p>
                </fieldset>
              </>
            )}

            {step === 2 && (
              <>
                <ChipMultiSelect legend="Dietary preferences" options={DIETARY_PREFERENCES} labels={DIET_LABELS} value={diet} onChange={setDiet} />
                <ChipMultiSelect legend="Allergies (optional)" hint="Used to show warnings only when a food's source lists allergens." options={ALLERGENS} labels={ALLERGEN_LABELS} value={allergens} onChange={setAllergens} />
                {allergens.length > 0 && <Notice tone="warning">{ALLERGEN_DISCLAIMER}</Notice>}
                <Field label="Foods to flag" optional hint="Comma-separated words, e.g. pork, coconut. Matched against food names and ingredient lists.">
                  {(p) => <Input {...p} value={excluded} onChange={(e) => setExcluded(e.target.value)} />}
                </Field>
                <MealScheduleEditor meals={meals} onChange={setMeals} />
                {errors.meals && <p className="text-xs text-danger" role="alert">{errors.meals}</p>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Time zone" error={errors.timeZone} hint="Decides when your day starts and ends.">
                    {(p) => <TimeZoneSelect {...p} value={timeZone} onChange={setTimeZone} />}
                  </Field>
                  <Field label="Week starts on">
                    {(p) => (
                      <Select {...p} value={weekStartsOn} onChange={(e) => setWeekStartsOn(Number(e.target.value) as 0 | 1)}>
                        <option value={0}>Sunday</option>
                        <option value={1}>Monday</option>
                      </Select>
                    )}
                  </Field>
                </div>
                <fieldset className="space-y-3">
                  <legend className="text-[13px] font-medium text-ink">Notifications</legend>
                  <ToggleRow label="Meal reminders" description="An in-app reminder at each meal time if nothing is logged yet." checked={notifications.mealReminders} onChange={(v) => setNotifications((n) => ({ ...n, mealReminders: v }))} />
                  <ToggleRow label="Hydration reminders" description="Periodic check-ins between 08:00 and 21:00." checked={notifications.hydrationReminders} onChange={(v) => setNotifications((n) => ({ ...n, hydrationReminders: v }))} />
                  <ToggleRow label="Goal progress" description="A note when you reach or go above your daily calorie goal." checked={notifications.goalProgress} onChange={(v) => setNotifications((n) => ({ ...n, goalProgress: v }))} />
                </fieldset>
              </>
            )}

            {submitError && <InlineError message={submitError} />}

            <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-between">
              <Button variant="secondary" onClick={() => { setErrors({}); setStep((s) => Math.max(0, s - 1)); }} disabled={step === 0 || saving}>
                Back
              </Button>
              <Button type="submit" loading={saving}>
                {step < STEPS.length - 1 ? 'Continue' : 'Finish setup'}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <ConfirmDialog
        open={skipOpen}
        onOpenChange={setSkipOpen}
        title="Skip setup?"
        description="You'll go straight to your dashboard without calorie or macro targets. You can set goals any time from the Goals page and update your profile in Settings."
        confirmLabel="Skip setup"
        onConfirm={skip}
      />
    </div>
  );
}

function Segmented({ name, value, onChange, options }: { name: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            'flex cursor-pointer items-center justify-center rounded-[var(--radius-control)] border px-2 py-2.5 text-center text-[13px] font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary',
            value === o.value ? 'border-primary bg-soft text-primary' : 'border-line bg-surface text-ink hover:border-line-strong',
          )}
        >
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
          {o.label}
        </label>
      ))}
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  const id = `toggle-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
        <p id={`${id}-desc`} className="text-[12px] text-muted">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-describedby={`${id}-desc`} />
    </div>
  );
}
