-- =============================================
-- AgroGestión - Schema de Base de Datos
-- Plataforma para Zootecnistas Colombianos
-- =============================================

-- ---- Perfiles de usuario ----
CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  rol         text NOT NULL DEFAULT 'propietario' CHECK (rol IN ('admin', 'propietario', 'trabajador')),
  telefono    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven su propio perfil"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Usuarios editan su propio perfil"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Usuarios insertan su propio perfil"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-crear perfil al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---- Fincas ----
CREATE TABLE fincas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           text NOT NULL,
  municipio        text,
  departamento     text,
  hectareas        numeric(10,2),
  tipo_produccion  text[],
  propietario_id   uuid REFERENCES profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fincas ENABLE ROW LEVEL SECURITY;

-- ---- Membresías por finca (multi-usuario) ----
CREATE TABLE finca_miembros (
  finca_id   uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  perfil_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rol        text NOT NULL DEFAULT 'trabajador' CHECK (rol IN ('propietario', 'trabajador')),
  PRIMARY KEY (finca_id, perfil_id)
);

ALTER TABLE finca_miembros ENABLE ROW LEVEL SECURITY;

-- Helper: verificar si el usuario es miembro de la finca
CREATE OR REPLACE FUNCTION es_miembro_finca(finca uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM finca_miembros
    WHERE finca_id = finca AND perfil_id = auth.uid()
  );
$$;

CREATE POLICY "Miembros ven su finca"
  ON fincas FOR SELECT USING (es_miembro_finca(id));

CREATE POLICY "Propietario crea finca"
  ON fincas FOR INSERT WITH CHECK (propietario_id = auth.uid());

CREATE POLICY "Propietario edita finca"
  ON fincas FOR UPDATE USING (propietario_id = auth.uid());

CREATE POLICY "Miembros ven membresías"
  ON finca_miembros FOR SELECT USING (es_miembro_finca(finca_id));

-- Auto-agregar propietario como miembro al crear finca
CREATE OR REPLACE FUNCTION public.handle_new_finca()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.finca_miembros (finca_id, perfil_id, rol)
  VALUES (NEW.id, NEW.propietario_id, 'propietario');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_finca_created
  AFTER INSERT ON fincas
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_finca();

-- ---- Especies animales ----
CREATE TABLE especies (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre  text NOT NULL UNIQUE
);

ALTER TABLE especies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos leen especies" ON especies FOR SELECT TO authenticated USING (true);

INSERT INTO especies (nombre) VALUES
  ('Bovino'), ('Porcino'), ('Equino'), ('Avícola'), ('Caprino'), ('Ovino'), ('Cunícola');

-- ---- Razas ----
CREATE TABLE razas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  especie_id  uuid NOT NULL REFERENCES especies(id)
);

ALTER TABLE razas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos leen razas" ON razas FOR SELECT TO authenticated USING (true);

INSERT INTO razas (nombre, especie_id) SELECT 'Brahman', id FROM especies WHERE nombre = 'Bovino';
INSERT INTO razas (nombre, especie_id) SELECT 'Holstein', id FROM especies WHERE nombre = 'Bovino';
INSERT INTO razas (nombre, especie_id) SELECT 'Cebú', id FROM especies WHERE nombre = 'Bovino';
INSERT INTO razas (nombre, especie_id) SELECT 'Normando', id FROM especies WHERE nombre = 'Bovino';
INSERT INTO razas (nombre, especie_id) SELECT 'Criollo', id FROM especies WHERE nombre = 'Bovino';
INSERT INTO razas (nombre, especie_id) SELECT 'Landrace', id FROM especies WHERE nombre = 'Porcino';
INSERT INTO razas (nombre, especie_id) SELECT 'Yorkshire', id FROM especies WHERE nombre = 'Porcino';

-- ---- Animales ----
CREATE TABLE animales (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id         uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  especie_id       uuid REFERENCES especies(id),
  raza_id          uuid REFERENCES razas(id),
  numero_arete     text,
  nombre           text,
  sexo             char(1) CHECK (sexo IN ('M', 'H')),
  fecha_nacimiento date,
  peso_actual      numeric(8,2),
  estado           text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'vendido', 'muerto', 'descartado')),
  madre_id         uuid REFERENCES animales(id),
  padre_id         uuid REFERENCES animales(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE animales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros CRUD animales de su finca"
  ON animales FOR ALL USING (es_miembro_finca(finca_id));

-- ---- Registros de peso ----
CREATE TABLE pesos_animales (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id       uuid NOT NULL REFERENCES animales(id) ON DELETE CASCADE,
  peso            numeric(8,2) NOT NULL,
  fecha           date NOT NULL DEFAULT CURRENT_DATE,
  observaciones   text,
  registrado_por  uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pesos_animales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros CRUD pesos de su finca"
  ON pesos_animales FOR ALL USING (
    EXISTS (SELECT 1 FROM animales a WHERE a.id = animal_id AND es_miembro_finca(a.finca_id))
  );

-- ---- Registros sanitarios ----
CREATE TABLE registros_sanitarios (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id          uuid NOT NULL REFERENCES animales(id) ON DELETE CASCADE,
  tipo               text NOT NULL CHECK (tipo IN ('vacuna', 'tratamiento', 'desparasitacion', 'cirugia', 'revision')),
  producto           text,
  dosis              text,
  via_administracion text,
  fecha_aplicacion   date NOT NULL DEFAULT CURRENT_DATE,
  fecha_proxima      date,
  veterinario        text,
  costo              numeric(12,2),
  observaciones      text,
  registrado_por     uuid REFERENCES profiles(id),
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE registros_sanitarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros CRUD sanitarios de su finca"
  ON registros_sanitarios FOR ALL USING (
    EXISTS (SELECT 1 FROM animales a WHERE a.id = animal_id AND es_miembro_finca(a.finca_id))
  );

-- ---- Registros de producción ----
CREATE TABLE registros_produccion (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id        uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  animal_id       uuid REFERENCES animales(id),
  tipo            text NOT NULL,
  cantidad        numeric(12,3) NOT NULL,
  unidad          text NOT NULL,
  fecha           date NOT NULL DEFAULT CURRENT_DATE,
  calidad         text,
  observaciones   text,
  registrado_por  uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE registros_produccion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros CRUD producción de su finca"
  ON registros_produccion FOR ALL USING (es_miembro_finca(finca_id));

-- ---- Categorías de inventario ----
CREATE TABLE inventario_categorias (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id  uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  nombre    text NOT NULL,
  color     text DEFAULT '#6B7280'
);

ALTER TABLE inventario_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros CRUD categorías de su finca"
  ON inventario_categorias FOR ALL USING (es_miembro_finca(finca_id));

-- ---- Inventario ----
CREATE TABLE inventario (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id          uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  categoria_id      uuid REFERENCES inventario_categorias(id),
  nombre            text NOT NULL,
  descripcion       text,
  unidad_medida     text,
  cantidad_actual   numeric(12,3) NOT NULL DEFAULT 0,
  cantidad_minima   numeric(12,3) NOT NULL DEFAULT 0,
  precio_unitario   numeric(12,2),
  proveedor         text,
  fecha_vencimiento date,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inventario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros CRUD inventario de su finca"
  ON inventario FOR ALL USING (es_miembro_finca(finca_id));

-- ---- Movimientos de inventario ----
CREATE TABLE movimientos_inventario (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventario_id  uuid NOT NULL REFERENCES inventario(id) ON DELETE CASCADE,
  tipo           text NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste')),
  cantidad       numeric(12,3) NOT NULL,
  motivo         text,
  fecha          date NOT NULL DEFAULT CURRENT_DATE,
  usuario_id     uuid REFERENCES profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE movimientos_inventario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros CRUD movimientos de su finca"
  ON movimientos_inventario FOR ALL USING (
    EXISTS (SELECT 1 FROM inventario i WHERE i.id = inventario_id AND es_miembro_finca(i.finca_id))
  );

-- Actualizar stock automáticamente al registrar movimiento
CREATE OR REPLACE FUNCTION actualizar_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
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

CREATE TRIGGER on_movimiento_inventario
  AFTER INSERT ON movimientos_inventario
  FOR EACH ROW EXECUTE FUNCTION actualizar_stock();

-- ---- Gastos operativos ----
CREATE TABLE gastos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finca_id         uuid NOT NULL REFERENCES fincas(id) ON DELETE CASCADE,
  categoria        text,
  descripcion      text NOT NULL,
  monto            numeric(14,2) NOT NULL,
  fecha            date NOT NULL DEFAULT CURRENT_DATE,
  comprobante_url  text,
  registrado_por   uuid REFERENCES profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros CRUD gastos de su finca"
  ON gastos FOR ALL USING (es_miembro_finca(finca_id));

-- =============================================
-- Índices para rendimiento
-- =============================================
CREATE INDEX idx_animales_finca ON animales(finca_id);
CREATE INDEX idx_animales_estado ON animales(estado);
CREATE INDEX idx_inventario_finca ON inventario(finca_id);
CREATE INDEX idx_inventario_stock_bajo ON inventario(finca_id) WHERE cantidad_actual <= cantidad_minima;
CREATE INDEX idx_registros_produccion_finca_fecha ON registros_produccion(finca_id, fecha DESC);
CREATE INDEX idx_movimientos_inventario_fecha ON movimientos_inventario(fecha DESC);
CREATE INDEX idx_registros_sanitarios_animal ON registros_sanitarios(animal_id);
CREATE INDEX idx_pesos_animal_fecha ON pesos_animales(animal_id, fecha DESC);
