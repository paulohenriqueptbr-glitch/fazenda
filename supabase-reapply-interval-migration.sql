-- Migration: Adicionar coluna reapply_interval_days em medication_records
-- A coluna já é usada pelo JS (forms.js, crud.js, alerts.js, predictions.js, push.js)
-- mas nunca foi criada no schema do banco.

alter table medication_records
  add column if not exists reapply_interval_days integer;

comment on column medication_records.reapply_interval_days is 'Intervalo em dias para reaplicação do medicamento (null = sem reaplicação)';
