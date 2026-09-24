export interface Patient {
  id: string;
  source: string;
  external_id: string;
  first_name: string | null;
  last_name: string | null;
  gender: string | null;
  birth_date: string | null;
}

export interface Condition {
  id: string;
  external_id: string;
  code: string | null;
  display: string | null;
  clinical_status: string | null;
}

export interface Medication {
  id: string;
  external_id: string;
  code: string | null;
  display: string | null;
  status: string | null;
  intent: string | null;
}

export interface PatientDetails extends Patient {
  conditions: Condition[];
  medications: Medication[];
}

export interface PatientResponse {
  data: Patient[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}