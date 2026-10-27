import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ALLERGENS, ALLERGEN_DISCLAIMER, DIETARY_PREFERENCES, isValidTimeZone, type MealSetting, type UserProfile } from '@nutritrack/shared';
import { useCurrentUser } from '@/services/auth';
import { useUpdateProfile } from '@/services/users';
import { errorMessage } from '@/lib/api';
import { applyTheme } from '@/lib/theme';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { InlineError, Notice } from '@/components/feedback/states';
import { ALLERGEN_LABELS, ChipMultiSelect, DIET_LABELS, MealScheduleEditor, TimeZoneSelect, parseExcluded } from './preferenceControls';

type Diet = (typeof DIETARY_PREFERENCES)[number];
type Allergen = (typeof ALLERGENS)[number];

export function PreferencesSection() {
  const user = useCurrentUser();
  const update = useUpdateProfile();
  const [units, setUnits] = useState(user.unitSystem);
  const [timeZone, setTimeZone] = useState(user.timeZone);
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(user.weekStartsOn);
  const [theme, setTheme] = useState<UserProfile['theme']>(user.theme);
  const [meals, setMeals] = useState<MealSetting[]>(user.meals);
  const [diet, setDiet] = useState(user.dietaryPreferences as Diet[]);
  const [allergens, setAllergens] = useState(user.allergens as Allergen[]);
  const [excluded, setExcluded] = useState(user.excludedFoods.join(', '));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const savedTheme = useRef(user.theme);
  useEffect(() => {
    savedTheme.current = user.theme;
  }, [user.theme]);
  // Theme changes preview instantly; leaving without saving restores the saved theme.
  useEffect(() => () => applyTheme(savedTheme.current), []);

  const save = async () => {
    const e: Record<string, string> = {};
    if (!isValidTimeZone(timeZone)) e.timeZone = 'Choose a valid time zone';
    if (meals.some((m) => !m.name.trim())) e.meals = 'Every meal needs a name';
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length) return;
    try {
      await update.mutateAsync({
        unitSystem: units,
        timeZone,
        weekStartsOn,
        theme,
        meals: meals.map((m) => ({ ...m, name: m.name.trim() })),
        dietaryPreferences: diet,
        allergens,
        excludedFoods: parseExcluded(excluded),
      });
      toast.success('Preferences saved');
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader title="Preferences" description="Units, calendar, appearance, meals and dietary settings." />
      <CardBody>
        <form className="space-y-6" noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Units" hint="Values are always stored in metric; this changes how they're shown and entered.">
              {(p) => (
                <Select {...p} value={units} onChange={(e) => setUnits(e.target.value as UserProfile['unitSystem'])}>
                  <option value="metric">Metric (cm, kg, ml)</option>
                  <option value="imperial">Imperial (ft/in, lb, fl oz)</option>
                </Select>
              )}
            </Field>
            <Field label="Theme">
              {(p) => (
                <Select
                  {...p}
                  value={theme}
                  onChange={(e) => {
                    const t = e.target.value as UserProfile['theme'];
                    setTheme(t);
                    applyTheme(t); // preview immediately; persisted on save
                  }}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">Match system</option>
                </Select>
              )}
            </Field>
            <Field label="Time zone" error={errors.timeZone} hint="Your diary day runs from midnight to midnight in this time zone.">
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
          {timeZone !== user.timeZone && (
            <Notice tone="warning">Changing your time zone changes which calendar day new entries default to. Existing entries keep the dates they were logged on.</Notice>
          )}

          <div>
            <MealScheduleEditor meals={meals} onChange={setMeals} />
            {errors.meals && <p className="mt-1 text-xs text-danger" role="alert">{errors.meals}</p>}
          </div>

          <ChipMultiSelect legend="Dietary preferences" options={DIETARY_PREFERENCES} labels={DIET_LABELS} value={diet} onChange={setDiet} />
          <ChipMultiSelect legend="Allergies" hint="Warnings appear only when a food's source provides allergen data." options={ALLERGENS} labels={ALLERGEN_LABELS} value={allergens} onChange={setAllergens} />
          <Notice tone="warning">{ALLERGEN_DISCLAIMER}</Notice>
          <Field label="Foods to flag" optional hint="Comma-separated words matched against food names and ingredient lists (max 20).">
            {(p) => <Input {...p} value={excluded} onChange={(e) => setExcluded(e.target.value)} placeholder="e.g. pork, coconut" />}
          </Field>

          {formError && <InlineError message={formError} />}
          <div className="flex justify-end">
            <Button type="submit" loading={update.isPending}>Save preferences</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
