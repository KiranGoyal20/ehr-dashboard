CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    source VARCHAR(20) NOT NULL,
    external_id VARCHAR(255) NOT NULL,

    first_name VARCHAR(255),
    last_name VARCHAR(255),
    gender VARCHAR(50),
    birth_date DATE,

    raw_data JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT patients_source_external_id_unique
        UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_patients_source
    ON patients(source);


CREATE TABLE IF NOT EXISTS conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    source VARCHAR(20) NOT NULL,
    external_id VARCHAR(255) NOT NULL,

    patient_id UUID NOT NULL
        REFERENCES patients(id)
        ON DELETE CASCADE,

    code VARCHAR(255),
    display TEXT,
    clinical_status VARCHAR(100),

    raw_data JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT conditions_source_external_id_unique
        UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_conditions_patient_id
    ON conditions(patient_id);


CREATE TABLE IF NOT EXISTS medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    source VARCHAR(20) NOT NULL,
    external_id VARCHAR(255) NOT NULL,

    patient_id UUID NOT NULL
        REFERENCES patients(id)
        ON DELETE CASCADE,

    code VARCHAR(255),
    display TEXT,
    status VARCHAR(100),
    intent VARCHAR(100),

    raw_data JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT medications_source_external_id_unique
        UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_medications_patient_id
    ON medications(patient_id);


CREATE TABLE IF NOT EXISTS sync_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    source VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'RUNNING',

    patients_processed INTEGER NOT NULL DEFAULT 0,
    conditions_processed INTEGER NOT NULL DEFAULT 0,
    medications_processed INTEGER NOT NULL DEFAULT 0,

    error TEXT,

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);