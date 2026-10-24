/**
 * Add or edit a patient, in four numbered parts: personal details, allergies,
 * medicines and today's check-up. Only the name and date of birth are needed;
 * everything else can be filled in later.
 */
import type { ReactNode } from 'react';
import { useFieldArray } from 'react-hook-form';
import { ALLERGY_SEVERITIES, BLOOD_TYPES, GENDERS } from '../../schemas/patientSchema';
import { usePatientForm } from '../../hooks/usePatientForm';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Icon } from '../../components/Icon';
import { Loading, PageHeader, Spinner } from '../../components/ui';
import { todayLocal } from '@shared/text';
import { normaliseKey } from '@shared/mergeEngine';
import { useI18n } from '../../i18n/useI18n';
import { tName } from '../../i18n/names';

export interface PatientFormProps {
  mode?: 'add' | 'edit';
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Part({ n, title, help, action, children }: { n: number; title: string; help?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card" aria-labelledby={`part-${n}`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-base font-bold text-white dark:bg-brand-400 dark:text-slate-950" aria-hidden="true">
            {n}
          </span>
          <div>
            <h2 id={`part-${n}`} className="section-title">
              {title}
            </h2>
            {help && <p className="mt-1 text-base text-slate-700 dark:text-slate-300">{help}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
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
  const errorCount = Object.keys(errors).length;
  const { t } = useI18n();

  const allergies = useFieldArray({ control, name: 'allergies' });
  const medications = useFieldArray({ control, name: 'medications' });
  const watchedMeds = watch('medications');

  const conflictedMeds = new Set((patient?.medications ?? []).filter((m) => m.openConflictIds.length > 0).map((m) => normaliseKey(m.name)));

  if (isLoading) return <Loading label={t('Opening the patient record…')} />;

  const addAllergy = () => allergies.append({ allergen: '', severity: 'unknown', reaction: '' });
  const addMedicine = () => medications.append({ name: '', dosage: '', frequency: '', startDate: '', endDate: '' });

  return (
    <div className="pb-12">
      <PageHeader
        back={isEditMode && patient ? { to: `/patients/${patient.id}`, label: tName(patient.name) } : { to: '/patients', label: t('Patients') }}
        title={isEditMode ? t('Edit {name}', { name: tName(patient?.name) || t('patient') }) : t('Add a new patient')}
        subtitle={
          isEditMode
            ? t('Change what you need and press "Save changes". Only what you change is sent, so edits made on other devices are kept.')
            : t('Only the name and date of birth are needed now. You can add the rest later.')
        }
      />

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        {submitCount > 0 && errorCount > 0 && (
          <div role="alert" className="notice-danger">
            <Icon name="alert" className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <p>{t('Some answers need fixing before this record can be saved. Look for the red messages below.')}</p>
          </div>
        )}

        <Part n={1} title={t('Personal details')}>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Input label={t('Full name')} required error={errors.name?.message} containerClassName="md:col-span-2" autoComplete="off" {...register('name')} />
            <Input label={t('Date of birth')} required type="date" max={todayLocal()} error={errors.dateOfBirth?.message} {...register('dateOfBirth')} />
            <Select label={t('Gender')} options={GENDERS.map((g) => ({ value: g, label: t(cap(g)) }))} placeholder="" error={errors.gender?.message} {...register('gender')} />
            <Select
              label={t('Blood group')}
              helperText={t('Choose "Unknown" if it has not been tested.')}
              options={BLOOD_TYPES.map((b) => ({ value: b, label: t(b) }))}
              placeholder=""
              error={errors.bloodType?.message}
              {...register('bloodType')}
            />
            <Input label={t('Phone number')} type="tel" inputMode="tel" helperText={t('For example: 98200 12345')} error={errors.contactNumber?.message} {...register('contactNumber')} />
          </div>
        </Part>

        <Part
          n={2}
          title={t('Allergies')}
          help={t('Medicines, foods or other things that cause a reaction. Allergies added on any device are never lost.')}
          action={
            allergies.fields.length > 0 && (
              <button type="button" className="btn-secondary btn-sm" onClick={addAllergy}>
                <Icon name="plus" className="h-5 w-5" /> {t('Add another allergy')}
              </button>
            )
          }
        >
          {allergies.fields.length === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-lg border-2 border-dashed border-slate-300 p-5 dark:border-slate-600">
              <p className="text-base text-slate-800 dark:text-slate-200">{t('No allergies recorded.')}</p>
              <button type="button" className="btn-secondary" onClick={addAllergy}>
                <Icon name="plus" className="h-5 w-5" /> {t('Add allergy')}
              </button>
            </div>
          ) : (
            <ol className="space-y-4">
              {allergies.fields.map((field, index) => (
                <li key={field.id} className="rounded-lg border border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                  <p className="mb-3 text-base font-bold text-slate-900 dark:text-white">{t('Allergy {n}', { n: index + 1 })}</p>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Input label={t('Allergic to')} required helperText={t('For example: Penicillin')} error={errors.allergies?.[index]?.allergen?.message} id={`allergies-${index}-allergen`} {...register(`allergies.${index}.allergen`)} />
                    <Select label={t('How serious?')} options={ALLERGY_SEVERITIES.map((s) => ({ value: s, label: t(cap(s)) }))} placeholder="" id={`allergies-${index}-severity`} {...register(`allergies.${index}.severity`)} />
                    <Input label={t('What happens?')} helperText={t('For example: Rash, swelling')} error={errors.allergies?.[index]?.reaction?.message} id={`allergies-${index}-reaction`} {...register(`allergies.${index}.reaction`)} />
                  </div>
                  <button type="button" onClick={() => allergies.remove(index)} className="btn-danger-outline btn-sm mt-4">
                    <Icon name="trash" className="h-5 w-5" /> {t('Remove allergy {n}', { n: index + 1 })}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </Part>

        <Part
          n={3}
          title={t('Medicines')}
          help={t('Medicines the patient takes now. If two devices change the same dose at the same time, a doctor at the district hospital decides.')}
          action={
            medications.fields.length > 0 && (
              <button type="button" className="btn-secondary btn-sm" onClick={addMedicine}>
                <Icon name="plus" className="h-5 w-5" /> {t('Add another medicine')}
              </button>
            )
          }
        >
          {medications.fields.length === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-lg border-2 border-dashed border-slate-300 p-5 dark:border-slate-600">
              <p className="text-base text-slate-800 dark:text-slate-200">{t('No medicines recorded.')}</p>
              <button type="button" className="btn-secondary" onClick={addMedicine}>
                <Icon name="plus" className="h-5 w-5" /> {t('Add medicine')}
              </button>
            </div>
          ) : (
            <ol className="space-y-4">
              {medications.fields.map((field, index) => {
                const inReview = conflictedMeds.has(normaliseKey(watchedMeds?.[index]?.name ?? ''));
                return (
                  <li
                    key={field.id}
                    className={`rounded-lg border p-4 ${inReview ? 'border-amber-500 bg-amber-50 dark:border-amber-500 dark:bg-amber-950/40' : 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50'}`}
                  >
                    <p className="mb-3 text-base font-bold text-slate-900 dark:text-white">{t('Medicine {n}', { n: index + 1 })}</p>
                    {inReview && (
                      <p className="mb-3 flex items-start gap-2 text-base font-semibold text-amber-900 dark:text-amber-200">
                        <Icon name="alert" className="mt-0.5 h-5 w-5 flex-shrink-0" /> {t('This dose is waiting for a doctor to check it. A new change here is checked too.')}
                      </p>
                    )}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <Input label={t('Medicine name')} required helperText={t('For example: Metformin')} error={errors.medications?.[index]?.name?.message} id={`medications-${index}-name`} {...register(`medications.${index}.name`)} />
                      <Input label={t('Dose')} required helperText={t('For example: 500 mg')} error={errors.medications?.[index]?.dosage?.message} id={`medications-${index}-dosage`} {...register(`medications.${index}.dosage`)} />
                      <Input label={t('How often?')} helperText={t('For example: Twice daily')} error={errors.medications?.[index]?.frequency?.message} id={`medications-${index}-frequency`} {...register(`medications.${index}.frequency`)} />
                      <Input label={t('Start date')} type="date" id={`medications-${index}-startDate`} {...register(`medications.${index}.startDate`)} />
                      <Input label={t('End date')} type="date" helperText={t('Leave empty if it continues.')} error={errors.medications?.[index]?.endDate?.message} id={`medications-${index}-endDate`} {...register(`medications.${index}.endDate`)} />
                    </div>
                    <button type="button" onClick={() => medications.remove(index)} className="btn-danger-outline btn-sm mt-4">
                      <Icon name="trash" className="h-5 w-5" /> {t('Stop or remove medicine {n}', { n: index + 1 })}
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </Part>

        <Part
          n={4}
          title={isEditMode ? t('New check-up') : t('Check-up')}
          help={t('Fill in only what you measured today. Each check-up is added to the history with the time and your name.')}
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Input label={t('Blood pressure')} helperText={t('Top and bottom number, e.g. 120/80')} inputMode="numeric" error={errors.newVitals?.bloodPressure?.message} {...register('newVitals.bloodPressure')} />
            <Input label={t('Pulse (beats per minute)')} helperText={t('For example: 72')} inputMode="numeric" error={errors.newVitals?.heartRate?.message} {...register('newVitals.heartRate')} />
            <Input label={t('Temperature (°C)')} helperText={t('For example: 36.8')} inputMode="decimal" error={errors.newVitals?.temperature?.message} {...register('newVitals.temperature')} />
            <Input label={t('Breathing rate (per minute)')} helperText={t('For example: 16')} inputMode="numeric" error={errors.newVitals?.respiratoryRate?.message} {...register('newVitals.respiratoryRate')} />
            <Input label={t('Oxygen level SpO₂ (%)')} helperText={t('For example: 98')} inputMode="numeric" error={errors.newVitals?.oxygenSaturation?.message} {...register('newVitals.oxygenSaturation')} />
          </div>
        </Part>

        <div className="sticky bottom-[5rem] z-10 flex flex-col gap-3 rounded-xl border border-slate-300 bg-white p-4 shadow-pop sm:flex-row sm:items-center lg:bottom-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="flex min-w-0 flex-1 items-center gap-2 text-base text-slate-800 dark:text-slate-200">
            {isDirty ? (
              <>
                <Icon name="edit" className="h-5 w-5 flex-shrink-0 text-amber-700 dark:text-amber-300" /> {t('You have changes that are not saved yet.')}
              </>
            ) : (
              <>
                <Icon name="lock" className="h-5 w-5 flex-shrink-0" /> {t('Saved on this device first, locked (encrypted).')}
              </>
            )}
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={handleCancel} className="btn-plain flex-1 sm:flex-none" disabled={isSubmitting}>
              {t('Cancel')}
            </button>
            <button type="submit" className="btn-primary flex-1 sm:flex-none" disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : <Icon name="check" className="h-5 w-5" />}
              {isEditMode ? t('Save changes') : t('Save patient')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default PatientForm;
