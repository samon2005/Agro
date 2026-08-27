-- ============================================================
-- MÓDULO: Sanidad — recordatorios de aplicación de medicamentos
-- (hoy dentro de la app; el campo "canal" permite sumar WhatsApp
-- más adelante sin cambiar el modelo de datos)
-- Aplicar en: Supabase SQL Editor o con MCP apply_migration
-- ============================================================

CREATE TABLE IF NOT EXISTS recordatorios_medicacion_aves (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicacion_id   uuid NOT NULL REFERENCES medicaciones_aves(id) ON DELETE CASCADE,
  lote_id         uuid NOT NULL REFERENCES lotes_aves(id) ON DELETE CASCADE,
  finca_id        uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  fecha           date NOT NULL,
  hora            time,
  completado      boolean NOT NULL DEFAULT false,
  canal           text NOT NULL DEFAULT 'app' CHECK (canal IN ('app', 'whatsapp')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE recordatorios_medicacion_aves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Miembros CRUD recordatorios_medicacion_aves" ON recordatorios_medicacion_aves;
CREATE POLICY "Miembros CRUD recordatorios_medicacion_aves" ON recordatorios_medicacion_aves FOR ALL USING (es_miembro_finca(finca_id));
CREATE INDEX IF NOT EXISTS idx_recordatorios_medicacion_lote_fecha ON recordatorios_medicacion_aves(lote_id, fecha);
