-- Base de la plataforma: perfiles, fincas, quién pertenece a cada finca, el
-- inventario general y las tablas de animales individuales.
--
-- Estas tablas se crearon desde el panel de Supabase antes de llevar la carpeta
-- de migraciones; este archivo las reconstruye a partir de la base (octubre
-- 2026) para que la carpeta reproduzca todo en orden. Las columnas que agregan
-- migraciones posteriores (005, 006, 016, 028, 042, 044, 046, 050, 056, 058, 061)
-- no van aquí. Todo es idempotente: correrlo sobre la base actual no cambia nada.

-- ── Perfiles: uno por usuario de Auth ──
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  rol         text NOT NULL DEFAULT 'propietario' CHECK (rol IN ('admin', 'propietario', 'trabajador')),
  telefono    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Fincas y sus miembros ──
CREATE TABLE IF NOT EXISTS public.fincas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           text NOT NULL,
  municipio        text,
  departamento     text,
  hectareas        numeric(10,2),
  tipo_produccion  text[],
  propietario_id   uuid REFERENCES public.profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finca_miembros (
  finca_id   uuid NOT NULL REFERENCES public.fincas(id) ON DELETE CASCADE,
  perfil_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rol        text NOT NULL DEFAULT 'trabajador' CHECK (rol IN ('propietario', 'trabajador')),
  PRIMARY KEY (finca_id, perfil_id)
);

-- ¿El usuario con sesión pertenece a la finca? Lo usan casi todas las políticas
CREATE OR REPLACE FUNCTION public.es_miembro_finca(finca uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM finca_miembros
    WHERE finca_id = finca AND perfil_id = auth.uid()
  );
$$;

-- Al registrarse un usuario se crea su perfil
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Quien crea una finca queda como su propietario
CREATE OR REPLACE FUNCTION public.handle_new_finca()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.finca_miembros (finca_id, perfil_id, rol)
  VALUES (NEW.id, NEW.propietario_id, 'propietario');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_finca_created ON public.fincas;
CREATE TRIGGER on_finca_created AFTER INSERT ON public.fincas
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_finca();

-- ── Catálogos ──
CREATE TABLE IF NOT EXISTS public.especies (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre  text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.razas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  especie_id  uuid NOT NULL REFERENCES public.especies(id)
);

INSERT INTO public.especies (nombre) VALUES
  ('Avícola'), ('Bovino'), ('Caprino'), ('Cunícola'), ('Equino'), ('Ovino'), ('Porcino')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.razas (nombre, especie_id)
SELECT r.nombre, e.id FROM (VALUES
  ('Brahman', 'Bovino'), ('Cebú', 'Bovino'), ('Criollo', 'Bovino'), ('Holstein', 'Bovino'), ('Normando', 'Bovino'),
  ('Landrace', 'Porcino'), ('Yorkshire', 'Porcino')
) AS r(nombre, especie) JOIN public.especies e ON e.nombre = r.especie
WHERE NOT EXISTS (SELECT 1 FROM public.razas x WHERE x.nombre = r.nombre AND x.especie_id = e.id);

-- ── Animales individuales (primer modelo de la plataforma) ──
CREATE TABLE IF NOT EXISTS public.animales (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id          uuid NOT NULL REFERENCES public.fincas(id) ON DELETE CASCADE,
  especie_id        uuid REFERENCES public.especies(id),
  raza_id           uuid REFERENCES public.razas(id),
  numero_arete      text,
  nombre            text,
  sexo              character(1) CHECK (sexo IN ('M', 'H')),
  fecha_nacimiento  date,
  peso_actual       numeric(8,2),
  estado            text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'vendido', 'muerto', 'descartado')),
  madre_id          uuid REFERENCES public.animales(id),
  padre_id          uuid REFERENCES public.animales(id),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_animales_finca ON public.animales (finca_id);
CREATE INDEX IF NOT EXISTS idx_animales_estado ON public.animales (estado);

CREATE TABLE IF NOT EXISTS public.pesos_animales (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id       uuid NOT NULL REFERENCES public.animales(id) ON DELETE CASCADE,
  peso            numeric(8,2) NOT NULL,
  fecha           date NOT NULL DEFAULT CURRENT_DATE,
  observaciones   text,
  registrado_por  uuid REFERENCES public.profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pesos_animal_fecha ON public.pesos_animales (animal_id, fecha DESC);

CREATE TABLE IF NOT EXISTS public.registros_sanitarios (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id           uuid NOT NULL REFERENCES public.animales(id) ON DELETE CASCADE,
  tipo                text NOT NULL CHECK (tipo IN ('vacuna', 'tratamiento', 'desparasitacion', 'cirugia', 'revision')),
  producto            text,
  dosis               text,
  via_administracion  text,
  fecha_aplicacion    date NOT NULL DEFAULT CURRENT_DATE,
  fecha_proxima       date,
  veterinario         text,
  costo               numeric(12,2),
  observaciones       text,
  registrado_por      uuid REFERENCES public.profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_registros_sanitarios_animal ON public.registros_sanitarios (animal_id);

CREATE TABLE IF NOT EXISTS public.registros_produccion (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id        uuid NOT NULL REFERENCES public.fincas(id) ON DELETE CASCADE,
  animal_id       uuid REFERENCES public.animales(id),
  tipo            text NOT NULL,
  cantidad        numeric(12,3) NOT NULL,
  unidad          text NOT NULL,
  fecha           date NOT NULL DEFAULT CURRENT_DATE,
  calidad         text,
  observaciones   text,
  registrado_por  uuid REFERENCES public.profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_registros_produccion_finca_fecha ON public.registros_produccion (finca_id, fecha DESC);

-- ── Inventario general y gastos ──
CREATE TABLE IF NOT EXISTS public.inventario_categorias (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id  uuid NOT NULL REFERENCES public.fincas(id) ON DELETE CASCADE,
  nombre    text NOT NULL,
  color     text DEFAULT '#6B7280'
);

CREATE TABLE IF NOT EXISTS public.inventario (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id           uuid NOT NULL REFERENCES public.fincas(id) ON DELETE CASCADE,
  categoria_id       uuid REFERENCES public.inventario_categorias(id),
  nombre             text NOT NULL,
  descripcion        text,
  unidad_medida      text,
  cantidad_actual    numeric(12,3) NOT NULL DEFAULT 0,
  cantidad_minima    numeric(12,3) NOT NULL DEFAULT 0,
  precio_unitario    numeric(12,2),
  proveedor          text,
  fecha_vencimiento  date,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventario_finca ON public.inventario (finca_id);
CREATE INDEX IF NOT EXISTS idx_inventario_stock_bajo ON public.inventario (finca_id) WHERE cantidad_actual <= cantidad_minima;

CREATE TABLE IF NOT EXISTS public.movimientos_inventario (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventario_id  uuid NOT NULL REFERENCES public.inventario(id) ON DELETE CASCADE,
  tipo           text NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
  cantidad       numeric(12,3) NOT NULL,
  motivo         text,
  fecha          date NOT NULL DEFAULT CURRENT_DATE,
  usuario_id     uuid REFERENCES public.profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_movimientos_inventario_fecha ON public.movimientos_inventario (fecha DESC);

-- Un movimiento mueve el saldo del ítem
CREATE OR REPLACE FUNCTION public.actualizar_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tipo = 'entrada' THEN
    UPDATE inventario SET cantidad_actual = cantidad_actual + NEW.cantidad WHERE id = NEW.inventario_id;
  ELSIF NEW.tipo = 'salida' THEN
    UPDATE inventario SET cantidad_actual = cantidad_actual - NEW.cantidad WHERE id = NEW.inventario_id;
  ELSIF NEW.tipo = 'ajuste' THEN
    UPDATE inventario SET cantidad_actual = NEW.cantidad WHERE id = NEW.inventario_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_movimiento_inventario ON public.movimientos_inventario;
CREATE TRIGGER on_movimiento_inventario AFTER INSERT ON public.movimientos_inventario
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_stock();

CREATE TABLE IF NOT EXISTS public.gastos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id         uuid NOT NULL REFERENCES public.fincas(id) ON DELETE CASCADE,
  categoria        text,
  descripcion      text NOT NULL,
  monto            numeric(14,2) NOT NULL,
  fecha            date NOT NULL DEFAULT CURRENT_DATE,
  comprobante_url  text,
  registrado_por   uuid REFERENCES public.profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── Seguridad por filas ──
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fincas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finca_miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.especies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.razas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.animales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pesos_animales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_sanitarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_produccion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios ven su propio perfil" ON public.profiles;
CREATE POLICY "Usuarios ven su propio perfil" ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Usuarios insertan su propio perfil" ON public.profiles;
CREATE POLICY "Usuarios insertan su propio perfil" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Usuarios editan su propio perfil" ON public.profiles;
CREATE POLICY "Usuarios editan su propio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Miembros ven su finca" ON public.fincas;
CREATE POLICY "Miembros ven su finca" ON public.fincas FOR SELECT USING (es_miembro_finca(id));
DROP POLICY IF EXISTS "Propietario crea finca" ON public.fincas;
CREATE POLICY "Propietario crea finca" ON public.fincas FOR INSERT WITH CHECK (propietario_id = auth.uid());
DROP POLICY IF EXISTS "Propietario edita finca" ON public.fincas;
CREATE POLICY "Propietario edita finca" ON public.fincas FOR UPDATE USING (propietario_id = auth.uid());
-- (La de borrar la finca está en la 043)

DROP POLICY IF EXISTS "Miembros ven membresías" ON public.finca_miembros;
CREATE POLICY "Miembros ven membresías" ON public.finca_miembros FOR SELECT USING (es_miembro_finca(finca_id));

DROP POLICY IF EXISTS "Todos leen especies" ON public.especies;
CREATE POLICY "Todos leen especies" ON public.especies FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Todos leen razas" ON public.razas;
CREATE POLICY "Todos leen razas" ON public.razas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Miembros CRUD animales de su finca" ON public.animales;
CREATE POLICY "Miembros CRUD animales de su finca" ON public.animales FOR ALL USING (es_miembro_finca(finca_id));
DROP POLICY IF EXISTS "Miembros CRUD pesos de su finca" ON public.pesos_animales;
CREATE POLICY "Miembros CRUD pesos de su finca" ON public.pesos_animales FOR ALL
  USING (EXISTS (SELECT 1 FROM animales a WHERE a.id = pesos_animales.animal_id AND es_miembro_finca(a.finca_id)));
DROP POLICY IF EXISTS "Miembros CRUD sanitarios de su finca" ON public.registros_sanitarios;
CREATE POLICY "Miembros CRUD sanitarios de su finca" ON public.registros_sanitarios FOR ALL
  USING (EXISTS (SELECT 1 FROM animales a WHERE a.id = registros_sanitarios.animal_id AND es_miembro_finca(a.finca_id)));
DROP POLICY IF EXISTS "Miembros CRUD producción de su finca" ON public.registros_produccion;
CREATE POLICY "Miembros CRUD producción de su finca" ON public.registros_produccion FOR ALL USING (es_miembro_finca(finca_id));
DROP POLICY IF EXISTS "Miembros CRUD categorías de su finca" ON public.inventario_categorias;
CREATE POLICY "Miembros CRUD categorías de su finca" ON public.inventario_categorias FOR ALL USING (es_miembro_finca(finca_id));
DROP POLICY IF EXISTS "Miembros CRUD inventario de su finca" ON public.inventario;
CREATE POLICY "Miembros CRUD inventario de su finca" ON public.inventario FOR ALL USING (es_miembro_finca(finca_id));
DROP POLICY IF EXISTS "Miembros CRUD movimientos de su finca" ON public.movimientos_inventario;
CREATE POLICY "Miembros CRUD movimientos de su finca" ON public.movimientos_inventario FOR ALL
  USING (EXISTS (SELECT 1 FROM inventario i WHERE i.id = movimientos_inventario.inventario_id AND es_miembro_finca(i.finca_id)));
DROP POLICY IF EXISTS "Miembros CRUD gastos de su finca" ON public.gastos;
CREATE POLICY "Miembros CRUD gastos de su finca" ON public.gastos FOR ALL USING (es_miembro_finca(finca_id));
