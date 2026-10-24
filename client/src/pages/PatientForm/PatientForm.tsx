/**
 * Register or edit a patient. One column, four numbered parts (details,
 * allergies, medicines, today's check-up). Only the name and date of birth
 * are needed; field widths hint at the answer; problems are listed at the top
 * and next to each field.
 */
import type { ReactNode } from 'react';
import { useFieldArray, type FieldErrors } from 'react-hook-form';
import { ALLERGY_SEVERITIES, BLOOD_TYPES, GENDERS } from '../../schemas/patientSchema';
import { usePatientForm } from '../../hooks/usePatientForm';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { BackLink, Loading, Spinner } from '../../components/ui';
import { todayLocal } from '@shared/text';
import { normaliseKey } from '@shared/mergeEngine';
import { useI18n } from '../../i18n/useI18n';
import { t as translate } from '../../i18n/i18n';
import { tName } from '../../i18n/names';

export interface PatientFormProps {
  mode?: 'add' | 'edit';
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Field ids for the "There is a problem" links, in the order the form shows them. */
function problems(errors: FieldErrors): { id: string; message: string }[] {
  const out: { id: string; message: string }[] = [];
  const add = (id: string, e?: { message?: string }) => e?.message && out.push({ id, message: e.message });
  const e = errors as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  add('patient-name', e.name);
  add('patient-dob', e.dateOfBirth);
  add('patient-phone', e.contactNumber);
  (e.allergies ?? []).forEach?.((a: any, i: number) => a && (add(`allergies-${i}-allergen`, a.allergen), add(`allergies-${i}-reaction`, a.reaction))); // eslint-disable-line @typescript-eslint/no-explicit-any
  (e.medications ?? []).forEach?.((m: any, i: number) => m && (add(`medications-${i}-name`, m.name), add(`medications-${i}-dosage`, m.dosage), add(`medications-${i}-endDate`, m.endDate))); // eslint-disable-line @typescript-eslint/no-explicit-any
  const v = e.newVitals ?? {};
  for (const [k, id] of Object.entries({ bloodPressure: 'vital-bp', heartRate: 'vital-pulse', temperature: 'vital-temp', respiratoryRate: 'vital-rr', oxygenSaturation: 'vital-spo2' }))
    add(id, v[k]);
  return out;
}

function Part({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="section mt-12" aria-labelledby={`part-${n}`}>
      <h2 id={`part-${n}`} className="heading-l">
        <span className="text-muted">{n}.</span> {title}
      </h2>
      {hint && <p className="mt-2 text-muted">{hint}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function PatientForm({ mode }: PatientFormProps) {
  const { form, patient, isLoading, isSubmitting, isEditMode, onSubmit, handleCancel } = usePatientForm({ mode });
  const {
    register,
    control,
    watch,
    formState: { errors, isDirty, submitCount },
  } = form;
  const { t } = useI18n();

  const allergies = useFieldArray({ control, name: 'allergies' });
  const medications = useFieldArray({ control, name: 'medications' });
  const watchedMeds = watch('medications');
  const conflictedMeds = new Set((patient?.medications ?? []).filter((m) => m.openConflictIds.length > 0).map((m) => normaliseKey(m.name)));

  if (isLoading) return <Loading label={t('Opening the patient record…')} />;

  const addAllergy = () => allergies.append({ allergen: '', severity: 'unknown', reaction: '' });
  const addMedicine = () => medications.append({ name: '', dosage: '', frequency: '', startDate: '', endDate: '' });
  const listed = submitCount > 0 ? problems(errors) : [];

  return (
    <div className="max-w-[40rem]">
      <BackLink {...(isEditMode && patient ? { to: `/patients/${patient.id}`, label: tName(patient.name) } : { to: '/patients', label: t('Patients') })} />
      {isEditMode && patient && <span className="caption">{tName(patient.name)}</span>}
      <h1 className="heading-xl">{isEditMode ? t('Edit record') : t('Register a patient')}</h1>
      <p className="lead mt-4">
        {isEditMode
          ? t('Change what you need, then press "Save changes". Only what you change is sent, so edits made on other devices are kept.')
          : t('Only the name and date of birth are needed now. You can add the rest later.')}
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-8">
        {listed.length > 0 && (
          <div className="error-summary" role="alert">
            <h2 className="heading-m">{t('There is a problem')}</h2>
            <ul className="mt-3 space-y-1">
              {listed.map((p) => (
                <li key={p.id}>
                  <a href={`#${p.id}`} className="font-bold text-alert underline">
                    {translate(p.message)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Part n={1} title={t('Personal details')}>
          <Input id="patient-name" label={t('Full name')} required error={errors.name?.message} autoComplete="off" {...register('name')} />
          <Input
            id="patient-dob"
            label={t('Date of birth')}
            required
            type="date"
            width="w-auto"
            helperText={t('If only the year is known, use 1 January of that year.')}
            max={todayLocal()}
            error={errors.dateOfBirth?.message}
            {...register('dateOfBirth')}
          />
          <Select id="patient-sex" label={t('Sex')} options={GENDERS.map((g) => ({ value: g, label: t(cap(g)) }))} error={errors.gender?.message} {...register('gender')} />
          <Select
            id="patient-blood"
            label={t('Blood group')}
            helperText={t('Choose "Unknown" if it has not been tested.')}
            options={BLOOD_TYPES.map((b) => ({ value: b, label: t(b) }))}
            error={errors.bloodType?.message}
            {...register('bloodType')}
          />
          <Input id="patient-phone" label={t('Phone number')} type="tel" inputMode="tel" width="w-chars-20" helperText={t('For example: 98200 12345')} error={errors.contactNumber?.message} {...register('contactNumber')} />
        </Part>

        <Part n={2} title={t('Allergies')} hint={t('Medicines, foods or other things that cause a reaction. Allergies added on any device are never lost.')}>
          {allergies.fields.length === 0 && <p className="mb-4">{t('No allergies recorded.')}</p>}
          {allergies.fields.map((field, index) => (
            <fieldset key={field.id} className="mb-6 border-l-[5px] border-rule pl-4">
              <legend className="heading-s mb-4">{t('Allergy {n}', { n: index + 1 })}</legend>
              <Input label={t('Allergic to')} required width="w-chars-20" helperText={t('For example: Penicillin')} error={errors.allergies?.[index]?.allergen?.message} id={`allergies-${index}-allergen`} {...register(`allergies.${index}.allergen`)} />
              <Select label={t('How serious?')} options={ALLERGY_SEVERITIES.map((s) => ({ value: s, label: t(cap(s)) }))} id={`allergies-${index}-severity`} {...register(`allergies.${index}.severity`)} />
              <Input label={t('What happens?')} helperText={t('For example: Rash, swelling')} error={errors.allergies?.[index]?.reaction?.message} id={`allergies-${index}-reaction`} {...register(`allergies.${index}.reaction`)} />
              <button type="button" onClick={() => allergies.remove(index)} className="btn-text -mt-2 mb-2 text-alert">
                {t('Remove allergy {n}', { n: index + 1 })}
              </button>
            </fieldset>
          ))}
          <button type="button" className="btn-secondary" onClick={addAllergy}>
            {allergies.fields.length ? t('Add another allergy') : t('Add allergy')}
          </button>
        </Part>

        <Part n={3} title={t('Medicines')} hint={t('Medicines the patient takes now. If two devices change the same dose at the same time, a doctor at the district hospital decides.')}>
          {medications.fields.length === 0 && <p className="mb-4">{t('No medicines recorded.')}</p>}
          {medications.fields.map((field, index) => {
            const inReview = conflictedMeds.has(normaliseKey(watchedMeds?.[index]?.name ?? ''));
            return (
              <fieldset key={field.id} className={`mb-6 border-l-[5px] pl-4 ${inReview ? 'border-warn' : 'border-rule'}`}>
                <legend className="heading-s mb-4">{t('Medicine {n}', { n: index + 1 })}</legend>
                {inReview && <p className="status-warn mb-4">{t('This dose is waiting for a doctor to check it. A new change here is checked too.')}</p>}
                <Input label={t('Medicine name')} required width="w-chars-20" helperText={t('For example: Metformin')} error={errors.medications?.[index]?.name?.message} id={`medications-${index}-name`} {...register(`medications.${index}.name`)} />
                <Input label={t('Dose')} required width="w-chars-10" helperText={t('For example: 500 mg')} error={errors.medications?.[index]?.dosage?.message} id={`medications-${index}-dosage`} {...register(`medications.${index}.dosage`)} />
                <Input label={t('How often?')} width="w-chars-20" helperText={t('For example: Twice daily')} error={errors.medications?.[index]?.frequency?.message} id={`medications-${index}-frequency`} {...register(`medications.${index}.frequency`)} />
                <div className="flex flex-wrap gap-x-8">
                  <Input label={t('Start date')} type="date" width="w-auto" id={`medications-${index}-startDate`} {...register(`medications.${index}.startDate`)} />
                  <Input label={t('End date')} type="date" width="w-auto" helperText={t('Leave empty if it continues.')} error={errors.medications?.[index]?.endDate?.message} id={`medications-${index}-endDate`} {...register(`medications.${index}.endDate`)} />
                </div>
                <button type="button" onClick={() => medications.remove(index)} className="btn-text -mt-2 mb-2 text-alert">
                  {t('Stop or remove medicine {n}', { n: index + 1 })}
                </button>
              </fieldset>
            );
          })}
          <button type="button" className="btn-secondary" onClick={addMedicine}>
            {medications.fields.length ? t('Add another medicine') : t('Add medicine')}
          </button>
        </Part>

        <Part n={4} title={isEditMode ? t('New check-up') : t('Check-up')} hint={t('Fill in only what you measured today. Each check-up is added to the history with the time and your name.')}>
          <div className="grid gap-x-8 sm:grid-cols-2">
            <Input id="vital-bp" label={t('Blood pressure')} helperText={t('Top and bottom number, e.g. 120/80')} width="w-chars-7" inputMode="numeric" error={errors.newVitals?.bloodPressure?.message} {...register('newVitals.bloodPressure')} />
            <Input id="vital-pulse" label={t('Pulse (beats per minute)')} helperText={t('For example: 72')} width="w-chars-4" inputMode="numeric" error={errors.newVitals?.heartRate?.message} {...register('newVitals.heartRate')} />
            <Input id="vital-temp" label={t('Temperature (°C)')} helperText={t('For example: 36.8')} width="w-chars-4" inputMode="decimal" error={errors.newVitals?.temperature?.message} {...register('newVitals.temperature')} />
            <Input id="vital-rr" label={t('Breathing rate (per minute)')} helperText={t('For example: 16')} width="w-chars-4" inputMode="numeric" error={errors.newVitals?.respiratoryRate?.message} {...register('newVitals.respiratoryRate')} />
            <Input id="vital-spo2" label={t('Oxygen level SpO₂ (%)')} helperText={t('For example: 98')} width="w-chars-4" inputMode="numeric" error={errors.newVitals?.oxygenSaturation?.message} {...register('newVitals.oxygenSaturation')} />
          </div>
        </Part>

        <div className="section mt-12">
          <p className="mb-5 text-muted">{isDirty ? t('You have changes that are not saved yet.') : t('Saved on this device first, locked (encrypted).')}</p>
          <div className="flex flex-wrap items-center gap-6">
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting && <Spinner />}
              {isEditMode ? t('Save changes') : t('Save patient')}
            </button>
            <button type="button" onClick={handleCancel} className="link" disabled={isSubmitting}>
              {t('Cancel')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default PatientForm;
