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

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.sri_comprobantes ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso para usuarios autenticados (limpieza previa para evitar errores)
DROP POLICY IF EXISTS "Permitir lectura general a autenticados" ON public.sri_comprobantes;
DROP POLICY IF EXISTS "Permitir inserción a autenticados" ON public.sri_comprobantes;
DROP POLICY IF EXISTS "Permitir actualización a autenticados" ON public.sri_comprobantes;

CREATE POLICY "Permitir lectura general a autenticados" 
ON public.sri_comprobantes
FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Permitir inserción a autenticados" 
ON public.sri_comprobantes
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir actualización a autenticados" 
ON public.sri_comprobantes
FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);
