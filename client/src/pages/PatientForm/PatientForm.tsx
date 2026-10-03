import { useFieldArray } from 'react-hook-form';
import { ALLERGY_SEVERITIES, BLOOD_TYPES, GENDERS } from '../../schemas/patientSchema';
import { usePatientForm } from '../../hooks/usePatientForm';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Card } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { PageHeader, Spinner } from '../../components/ui';
import { normaliseKey } from '@shared/mergeEngine';

export interface PatientFormProps {
  mode?: 'add' | 'edit';
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function PatientForm({ mode }: PatientFormProps) {
  const { form, patient, isLoading, isSubmitting, isEditMode, onSubmit, handleCancel } = usePatientForm({ mode });
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = form;

  const allergies = useFieldArray({ control, name: 'allergies' });
  const medications = useFieldArray({ control, name: 'medications' });
  const watchedMeds = watch('medications');

  const conflictedMeds = new Set(
    (patient?.medications ?? []).filter((m) => m.openConflictIds.length > 0).map((m) => normaliseKey(m.name)),
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3 text-slate-500">
        <Spinner className="h-8 w-8 text-teal-600" />
        <p className="text-sm font-medium">Loading patient record…</p>
      </div>
    );
  }

  return (
    <div className="pb-12">
      <PageHeader
        title={isEditMode ? `Edit ${patient?.name ?? 'patient'}` : 'Add new patient'}
        subtitle={
          isEditMode
            ? 'Only the fields you change are synced, so edits made on other devices are kept.'
            : 'Saved on this device first (encrypted). It syncs to the server when a connection is available.'
        }
      />

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <Card>
          <h2 className="section-title mb-4">Basic information</h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Input label="Full name" required placeholder="e.g. Asha Patil" error={errors.name?.message} containerClassName="md:col-span-2" {...register('name')} />
            <Input label="Date of birth" required type="date" max={new Date().toISOString().slice(0, 10)} error={errors.dateOfBirth?.message} {...register('dateOfBirth')} />
            <Select label="Gender" options={GENDERS.map((g) => ({ value: g, label: cap(g) }))} placeholder="" error={errors.gender?.message} {...register('gender')} />
            <Select label="Blood type" options={BLOOD_TYPES} placeholder="" error={errors.bloodType?.message} {...register('bloodType')} />
            <Input label="Contact number" type="tel" placeholder="e.g. 98200 12345" error={errors.contactNumber?.message} {...register('contactNumber')} />
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="section-title">Allergies</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Allergies added on any device are always kept when records merge.</p>
            </div>
            <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => allergies.append({ allergen: '', severity: 'unknown', reaction: '' })}>
              <Icon name="plus" className="h-3.5 w-3.5" /> Add allergy
            </button>
          </div>
          {allergies.fields.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">No known allergies</p>
          ) : (
            <div className="space-y-3">
              {allergies.fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-700 dark:bg-slate-800/40 md:grid-cols-[1.4fr_1fr_1.6fr_auto] md:items-start">
                  <Input label="Allergen" required placeholder="e.g. Penicillin" error={errors.allergies?.[index]?.allergen?.message} id={`allergies-${index}-allergen`} {...register(`allergies.${index}.allergen`)} />
                  <Select label="Severity" options={ALLERGY_SEVERITIES.map((s) => ({ value: s, label: cap(s) }))} placeholder="" id={`allergies-${index}-severity`} {...register(`allergies.${index}.severity`)} />
                  <Input label="Reaction" placeholder="e.g. Rash, swelling" error={errors.allergies?.[index]?.reaction?.message} id={`allergies-${index}-reaction`} {...register(`allergies.${index}.reaction`)} />
                  <button type="button" onClick={() => allergies.remove(index)} className="btn-ghost mt-6 self-start text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40" aria-label={`Remove allergy ${index + 1}`}>
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="section-title">Medications</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">If two devices change a dose at the same time, a clinical reviewer decides.</p>
            </div>
            <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => medications.append({ name: '', dosage: '', frequency: '', startDate: '', endDate: '' })}>
              <Icon name="plus" className="h-3.5 w-3.5" /> Add medication
            </button>
          </div>
          {medications.fields.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">No current medications</p>
          ) : (
            <div className="space-y-3">
              {medications.fields.map((field, index) => {
                const inConflict = conflictedMeds.has(normaliseKey(watchedMeds?.[index]?.name ?? ''));
                return (
                  <div key={field.id} className={`rounded-lg border p-3 ${inConflict ? 'border-orange-300 bg-orange-50/60 dark:border-orange-900 dark:bg-orange-950/20' : 'border-slate-200 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-800/40'}`}>
                    {inConflict && (
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-orange-800 dark:text-orange-300">
                        <Icon name="alert" className="h-3.5 w-3.5" /> This dose is waiting for clinical review. A change here is checked against it too.
                      </p>
                    )}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-start">
                      <Input label="Medication" required placeholder="e.g. Metformin" error={errors.medications?.[index]?.name?.message} id={`medications-${index}-name`} {...register(`medications.${index}.name`)} />
                      <Input label="Dosage" required placeholder="e.g. 500 mg" error={errors.medications?.[index]?.dosage?.message} id={`medications-${index}-dosage`} {...register(`medications.${index}.dosage`)} />
                      <Input label="Frequency" placeholder="e.g. Twice daily" error={errors.medications?.[index]?.frequency?.message} id={`medications-${index}-frequency`} {...register(`medications.${index}.frequency`)} />
                      <button type="button" onClick={() => medications.remove(index)} className="btn-ghost mt-6 self-start text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40" aria-label={`Stop medication ${index + 1}`} title="Stop / remove medication">
                        <Icon name="trash" className="h-4 w-4" />
                      </button>
                      <Input label="Start date" type="date" id={`medications-${index}-startDate`} {...register(`medications.${index}.startDate`)} />
                      <Input label="End date" type="date" error={errors.medications?.[index]?.endDate?.message} id={`medications-${index}-endDate`} {...register(`medications.${index}.endDate`)} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="section-title">{isEditMode ? 'Record new vitals' : 'Vitals'}</h2>
          <p className="mb-4 mt-1 text-xs text-slate-500 dark:text-slate-400">
            Each reading is added to the history with the time and who took it. Leave blank if not measured.
          </p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <Input label="Heart rate (bpm)" inputMode="numeric" placeholder="72" error={errors.newVitals?.heartRate?.message} {...register('newVitals.heartRate')} />
            <Input label="Blood pressure" placeholder="120/80" error={errors.newVitals?.bloodPressure?.message} {...register('newVitals.bloodPressure')} />
            <Input label="Temp (°C)" inputMode="decimal" placeholder="36.8" error={errors.newVitals?.temperature?.message} {...register('newVitals.temperature')} />
            <Input label="Resp. rate" inputMode="numeric" placeholder="16" error={errors.newVitals?.respiratoryRate?.message} {...register('newVitals.respiratoryRate')} />
            <Input label="SpO₂ (%)" inputMode="numeric" placeholder="98" error={errors.newVitals?.oxygenSaturation?.message} {...register('newVitals.oxygenSaturation')} />
          </div>
        </Card>

        <div className="sticky bottom-0 -mx-4 flex justify-end gap-3 border-t border-slate-200 bg-slate-50/95 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:mx-0 sm:rounded-lg">
          <button type="button" onClick={handleCancel} className="btn-secondary" disabled={isSubmitting}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting && <Spinner />}
            {isEditMode ? 'Save changes' : 'Save patient'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PatientForm;
