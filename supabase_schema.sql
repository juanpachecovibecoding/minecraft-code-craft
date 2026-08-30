-- ==============================================================================
-- Schema SQL para Supabase: Minecraft Prismarine + VisualModder
-- ==============================================================================

-- 1. Tabla de Perfiles de Usuario (vinculada a auth.users de Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_login TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS en perfiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver todos los perfiles"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Los usuarios pueden editar su propio perfil"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- 2. Tabla de Proyectos de Blockly (guardado de programas en la nube)
CREATE TABLE IF NOT EXISTS public.blockly_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL DEFAULT 'Sin Título',
    description TEXT DEFAULT '',
    xml_code TEXT NOT NULL,
    js_code TEXT NOT NULL,
    thumbnail TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en blockly_projects
ALTER TABLE public.blockly_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver sus propios proyectos"
    ON public.blockly_projects FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden insertar sus proyectos"
    ON public.blockly_projects FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus proyectos"
    ON public.blockly_projects FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus proyectos"
    ON public.blockly_projects FOR DELETE
    USING (auth.uid() = user_id);

-- 3. Tabla de Logs de Interacciones / Ejecuciones (para analítica y seguimiento de alumnos)
CREATE TABLE IF NOT EXISTS public.interaction_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    project_id UUID REFERENCES public.blockly_projects(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL, -- 'RUN_CODE', 'SAVE_PROJECT', 'BLOCKS_PLACED', 'LOGIN', 'SESSION_START'
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en interaction_logs
ALTER TABLE public.interaction_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden insertar sus propios logs"
    ON public.interaction_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden ver sus propios logs"
    ON public.interaction_logs FOR SELECT
    USING (auth.uid() = user_id);

-- 4. Trigger automático para crear perfil cuando un usuario se registra en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

