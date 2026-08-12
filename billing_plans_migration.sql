-- 1. Crear tabla billing_plans
CREATE TABLE IF NOT EXISTS public.billing_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    program_name TEXT,
    url TEXT,
    username TEXT,
    password TEXT,
    expiration_date TEXT,
    document_status TEXT,
    document_count INTEGER,
    price NUMERIC,
    sold_by_me BOOLEAN DEFAULT FALSE,
    provider_name TEXT,
    free_support_and_cancellation BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Asegurar que haya índice para client_id
CREATE INDEX IF NOT EXISTS idx_billing_plans_client_id ON public.billing_plans(client_id);

-- 3. Habilitar RLS
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

-- 4. Crear política básica (Asumiendo acceso público o autenticado general para la MVP web, ajusta según necesidad)
CREATE POLICY "Enable ALL for authenticated users" ON public.billing_plans
    AS PERMISSIVE FOR ALL
    TO public
    USING (true)
    WITH CHECK (true);
