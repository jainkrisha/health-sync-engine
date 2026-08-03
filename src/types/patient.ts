export interface Patient {
  id: string;
  name: string;
  dateOfBirth: string;
  bloodType: string;
  allergies: string[];
  medications: {
    name: string;
    dosage: string;
  }[];
  vitals: {
    heartRate?: number;
    bloodPressure?: string;
    temperature?: number;
  };
  createdAt: string;
  updatedAt: string;
}
