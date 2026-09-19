# Guia de Despliegue en Vercel i Supabase

## 1. Supabase Backend Setup

1. Crea un nuevo proyecto en [Supabase](https://supabase.com).
2. Abre la consola SQL Editor de Supabase y ejecuta la migración inicial:
   - `supabase/migrations/20260919000000_initial_schema.sql`
3. (Opcional) Carga los datos de prueba executando el script `supabase/seed.sql`.
4. Copia tu `API URL` y `anon public key` desde la sección *Settings > API*.

---

## 2. Configuración de Variables de Entorno

En local o en Vercel, configura las siguientes variables:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-de-supabase
```

---

## 3. Despliegue en Vercel

1. Importa el repositorio de Git en [Vercel](https://vercel.com).
2. Selecciona el Framework Preset: **Vite**.
3. Configura el comando de build: `npm run build`.
4. Añade las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
5. Haz clic en **Deploy**.

---

## 4. Scraping Desacoplado & Vercel Cron Jobs

El scraper está diseñado de forma modular mediante la interfaz `ScraperService`.
Para automatizar la ejecución periódica del scraper sin bloquear el frontend:

1. Crea un endpoint Serverless o Vercel Edge Function en `api/cron/scraping.ts`.
2. Configura el Cron Job en `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/scraping",
      "schedule": "0 2 * * *"
    }
  ]
}
```
