import { Controller, useFieldArray } from 'react-hook-form';
import { BLOOD_TYPES } from '../../schemas/patientSchema';
import { usePatientForm } from '../../hooks/usePatientForm';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { TagInput } from '../../components/TagInput';
import { Card } from '../../components/Card';

export interface PatientFormProps {
  mode?: 'add' | 'edit';
}

export function PatientForm({ mode }: PatientFormProps) {
  const {
    form: {
      register,
      control,
      formState: { errors },
    },
    isLoading,
    isSubmitting,
    isEditMode,
    onSubmit,
    handleCancel,
  } = usePatientForm({ mode });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'medications',
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-10 h-10 border-4 border-teal-600/30 border-t-teal-600 rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-500">Loading patient record...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {isEditMode ? 'Edit Patient Record' : 'Add New Patient'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isEditMode
              ? 'Update medical history, vitals, and personal details.'
              : 'Enter patient information to save to the local health record database.'}
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        {/* Section 1: Basic Information */}
        <Card>
          <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">
            Basic Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-1">
              <Input
                label="Full Name"
                placeholder="e.g. Jane Doe"
                required
                error={errors.name?.message}
                {...register('name')}
              />
            </div>
            <div className="md:col-span-1">
              <Input
                label="Date of Birth"
                type="date"
                required
                error={errors.dateOfBirth?.message}
                {...register('dateOfBirth')}
              />
            </div>
            <div className="md:col-span-1">
              <Select
                label="Blood Type"
                required
                options={BLOOD_TYPES}
                placeholder="Select blood type"
                error={errors.bloodType?.message}
                {...register('bloodType')}
              />
            </div>
          </div>
        </Card>

        {/* Section 2: Allergies */}
        <Card>
          <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">
            Allergies
          </h2>
          <Controller
            control={control}
            name="allergies"
            render={({ field }) => (
              <TagInput
                label="Known Allergies"
                placeholder="Type allergy (e.g. Penicillin, Peanuts) and press Enter"
                value={field.value || []}
                onChange={field.onChange}
                error={errors.allergies?.message}
                helperText="Press Enter or click Add after typing each allergy."
              />
            )}
          />
        </Card>

        {/* Section 3: Medications */}
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <h2 className="text-lg font-bold text-slate-800">Medications</h2>
            <button
              type="button"
              onClick={() => append({ name: '', dosage: '' })}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Add Medication
            </button>
          </div>

          {fields.length === 0 ? (
            <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50/50">
              <p className="text-xs text-slate-500">No medications currently listed.</p>
              <button
                type="button"
                onClick={() => append({ name: '', dosage: '' })}
                className="mt-2 text-xs font-semibold text-teal-600 hover:text-teal-700 hover:underline"
              >
                + Click to add first medication
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {fields.map((fieldItem, index) => (
                <div
                  key={fieldItem.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 transition-all"
                >
                  <div className="flex-1 w-full">
                    <Input
                      placeholder="Medication Name (e.g. Amoxicillin)"
                      error={errors.medications?.[index]?.name?.message}
                      {...register(`medications.${index}.name`)}
                    />
                  </div>
                  <div className="flex-1 w-full">
                    <Input
                      placeholder="Dosage (e.g. 500mg twice daily)"
                      error={errors.medications?.[index]?.dosage?.message}
                      {...register(`medications.${index}.dosage`)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors self-end sm:self-center"
                    aria-label={`Remove medication ${index + 1}`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Section 4: Vitals */}
        <Card>
          <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-3 mb-4">
            Vitals (Optional)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <Input
                label="Heart Rate (bpm)"
                type="number"
                placeholder="e.g. 72"
                error={errors.vitals?.heartRate?.message}
                {...register('vitals.heartRate', { valueAsNumber: true })}
              />
            </div>
            <div>
              <Input
                label="Blood Pressure"
                placeholder="e.g. 120/80"
                error={errors.vitals?.bloodPressure?.message}
                {...register('vitals.bloodPressure')}
              />
            </div>
            <div>
              <Input
                label="Temperature (°C / °F)"
                type="number"
                step="0.1"
                placeholder="e.g. 36.6"
                error={errors.vitals?.temperature?.message}
                {...register('vitals.temperature', { valueAsNumber: true })}
              />

            </div>
          </div>
        </Card>

        {/* Form Action Bar */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition-colors shadow-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:opacity-50 transition-all shadow-md flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Patient</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default PatientForm;
