import { useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ACTIVITY_LABELS, isValidDateString, todayInTimeZone, type ActivityLevel, type UserProfile, type WeightGoal } from '@nutritrack/shared';
import { useCurrentUser } from '@/services/auth';
import { useUpdateProfile } from '@/services/users';
import { ApiError, errorMessage } from '@/lib/api';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { InlineError } from '@/components/feedback/states';
import { HeightInput, SEX_OPTIONS, WeightInput, fromKg, toKg } from './preferenceControls';

export function ProfileSection() {
  const user = useCurrentUser();
  const update = useUpdateProfile();
  const units = user.unitSystem;
  const [name, setName] = useState(user.name);
  const [dob, setDob] = useState(user.dateOfBirth ?? '');
  const [sex, setSex] = useState<UserProfile['sex']>(user.sex);
  const [heightCm, setHeightCm] = useState(user.heightCm ? String(user.heightCm) : '');
  const [activity, setActivity] = useState<ActivityLevel | ''>(user.activityLevel ?? '');
  const [weightGoal, setWeightGoal] = useState<WeightGoal | ''>(user.weightGoal ?? '');
  const [target, setTarget] = useState(fromKg(user.targetWeightKg, units));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const today = todayInTimeZone(user.timeZone);

  const save = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Enter your name';
    if (dob && (!isValidDateString(dob) || dob > today)) e.dateOfBirth = 'Enter a valid date in the past';
    const h = Number(heightCm);
    if (heightCm && !(h >= 50 && h <= 272)) e.heightCm = 'Enter a height between 50 and 272 cm';
    const t = target.trim() ? toKg(target, units) : null;
    if (target.trim() && (t === null || t < 20 || t > 400)) e.targetWeightKg = 'Enter a realistic target weight or leave it empty';
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length) return;
    try {
      await update.mutateAsync({
        name: name.trim(),
        dateOfBirth: dob || null,
        sex,
        heightCm: heightCm ? h : null,
        activityLevel: activity || null,
        weightGoal: weightGoal || null,
        targetWeightKg: t,
      });
      toast.success('Profile saved');
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) setErrors(err.fieldErrors());
      setFormError(errorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader title="Profile" description={`Last updated ${format(new Date(user.profileUpdatedAt), "d MMM yyyy 'at' HH:mm")}`} />
      <CardBody>
        <form className="space-y-5" noValidate onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Display name" error={errors.name}>
              {(p) => <Input {...p} autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />}
            </Field>
            <Field label="Email" hint="Email changes aren't supported yet.">
              {(p) => <Input {...p} value={user.email} readOnly disabled />}
            </Field>
            <Field label="Date of birth" optional error={errors.dateOfBirth}>
              {(p) => <Input {...p} type="date" max={today} value={dob} onChange={(e) => setDob(e.target.value)} />}
            </Field>
            <Field label="Sex for energy estimates" optional>
              {(p) => (
                <Select {...p} value={sex} onChange={(e) => setSex(e.target.value as UserProfile['sex'])}>
                  {SEX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Height" optional error={errors.heightCm}>
              {(p) => <HeightInput {...p} units={units} cm={heightCm} onChange={setHeightCm} />}
            </Field>
            <Field label="Target weight" optional error={errors.targetWeightKg}>
              {(p) => <WeightInput {...p} units={units} value={target} onChange={setTarget} />}
            </Field>
            <Field label="Activity level" optional>
              {(p) => (
                <Select {...p} value={activity} onChange={(e) => setActivity(e.target.value as ActivityLevel | '')}>
                  <option value="">Not set</option>
                  {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((k) => <option key={k} value={k}>{ACTIVITY_LABELS[k]}</option>)}
                </Select>
              )}
            </Field>
            <Field label="Weight goal" optional>
              {(p) => (
                <Select {...p} value={weightGoal} onChange={(e) => setWeightGoal(e.target.value as WeightGoal | '')}>
                  <option value="">Not set</option>
                  <option value="lose">Lose weight</option>
                  <option value="maintain">Maintain weight</option>
                  <option value="gain">Gain weight</option>
                </Select>
              )}
            </Field>
          </div>
          <p className="text-[12px] text-muted">Current weight is recorded on the Weight &amp; water page. Calorie and macro targets are managed on the Goals page.</p>
          {formError && <InlineError message={formError} />}
          <div className="flex justify-end">
            <Button type="submit" loading={update.isPending}>Save profile</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
