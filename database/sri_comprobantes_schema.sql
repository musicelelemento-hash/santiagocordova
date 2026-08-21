-- Tabla para almacenar el historial de comprobantes autorizados y fallidos del SRI
CREATE TABLE IF NOT EXISTS public.sri_comprobantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo VARCHAR(50) NOT NULL, -- 'factura', 'retencion', 'nota_credito', etc.
    secuencial VARCHAR(20) NOT NULL,
    clave_acceso VARCHAR(49) UNIQUE NOT NULL,
    ruc_receptor VARCHAR(13) NOT NULL,
    nombre_receptor TEXT NOT NULL,
    fecha_emision DATE NOT NULL,
    total NUMERIC(12, 2) NOT NULL,
    estado VARCHAR(30) NOT NULL, -- 'Autorizado', 'Error', etc.
    xml TEXT,
    ambiente CHAR(1) NOT NULL, -- '1' = Pruebas, '2' = Producción
    mensaje_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabla para almacenar la configuración del emisor y firma electrónica en la nube
CREATE TABLE IF NOT EXISTS public.emisor_settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'default_emisor',
    ruc VARCHAR(13),
    razon_social TEXT,
    nombre_comercial TEXT,
    dir_matriz TEXT,
    estab VARCHAR(10),
    pto_emi VARCHAR(10),
    regimen VARCHAR(20),
    ambiente CHAR(1) DEFAULT '2',
    secuencial_inicio INT DEFAULT 13,
    last_seq_factura INT DEFAULT 0,
    last_seq_retencion INT DEFAULT 0,
    p12_base64 TEXT,
    p12_filename TEXT,
    p12_password TEXT,
    p12_start TEXT,
    p12_expiry TEXT,
    p12_subject TEXT,
    p12_owner TEXT,
    logo_base64 TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.sri_comprobantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emisor_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso blindadas con RLS (Requiere usuario autenticado)
DROP POLICY IF EXISTS "Permitir lectura general" ON public.sri_comprobantes;
DROP POLICY IF EXISTS "Permitir inserción general" ON public.sri_comprobantes;
DROP POLICY IF EXISTS "Permitir actualización general" ON public.sri_comprobantes;

CREATE POLICY "Permitir lectura autenticada" 
ON public.sri_comprobantes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir inserción autenticada" 
ON public.sri_comprobantes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Permitir actualización autenticada" 
ON public.sri_comprobantes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acceso a emisor_settings" ON public.emisor_settings;
-- La tabla emisor_settings almacena certificados p12 y claves de firma: SOLO para usuarios autenticados / service role
CREATE POLICY "Permitir acceso seguro a emisor_settings" 
ON public.emisor_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- RPC for atomic sequence increment
CREATE OR REPLACE FUNCTION get_next_sri_secuencial(p_tipo VARCHAR)
RETURNS INT AS $$
DECLARE
    v_next INT;
BEGIN
    IF p_tipo = 'factura' THEN
        UPDATE public.emisor_settings
        SET last_seq_factura = last_seq_factura + 1
        WHERE id = 'default_emisor'
        RETURNING last_seq_factura INTO v_next;
    ELSE
        UPDATE public.emisor_settings
        SET last_seq_retencion = last_seq_retencion + 1
        WHERE id = 'default_emisor'
        RETURNING last_seq_retencion INTO v_next;
    END IF;
    
    RETURN v_next;
END;
$$ LANGUAGE plpgsql;
