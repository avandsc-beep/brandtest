# BrandTest - Valoracion de Marcas Graficas

Instrumento de valoracion de marcas graficas basado en los indicadores de Chaves y Belluccia.

## IMPORTANTE: donde se trabaja

**Todo el desarrollo es en React + Vite, dentro de `src/`.** No edites `index.html`
(es solo el punto de entrada de Vite, ~30 lineas: si crece, algo esta mal) ni
subas archivos por la web de GitHub — cada cambio se hace en el codigo, se
prueba local con `npm run dev` + `npm test`, y se pushea a `main` (Vercel
deploya solo). El HTML viejo pre-migracion quedo como referencia en
`legacy-index.html` y `src/legacy/` — no se toca ni se vuelve a usar.

## Estructura

```text
api/                         Funciones serverless (Vercel). _utils.js = helpers de seguridad compartidos
api/webhooks/paddle.js       Webhook de pagos — el UNICO lugar que convierte dinero en creditos
api/supabase_schema.sql      Schema completo de la base (fuente de verdad, PARTE 1-22)
public/                      Archivos publicos de la app (iconos PWA, manifest, service worker)
src/components/              La app real, por componentes (dashboard, admin, results, upload...)
src/hooks/                   Logica de datos (useBilling, useCredits, useSupabaseAuth...)
src/lib/                     Motor de analisis y utilidades puras
src/styles/app-theme.css     Sistema visual (tokens + clases bx-)
src/App.jsx                  Componente React principal
src/main.jsx                 Entrada de React
src/legacy/                  Codigo pre-migracion (solo referencia, no se monta)
legacy-index.html            Copia del HTML original antes de migrar (solo referencia)
index.html                   Entrada de Vite — NO EDITAR
vercel.json                  Headers de seguridad (CSP, HSTS, etc.)
vite.config.js               Configuracion de Vite
test_engine.js               Pruebas de regresion del motor (npm test)
```

## Seguridad (no romper al tocar el backend)

- Todos los endpoints del navegador validan server-side: origen (CORS),
  sesion real de Supabase, formato de inputs y rate limiting (ver `api/_utils.js`).
- La base usa Row Level Security en todas las tablas; solo el service role
  (backend) puede escribir creditos/pagos.
- Secretos SOLO en variables de entorno de Vercel — jamas en el codigo ni en Git.
- El CSP de `vercel.json` lista los origenes permitidos (Supabase, Paddle,
  Google Fonts): si agregas un servicio externo nuevo, hay que sumarlo ahi.

## Requisitos para una laptop nueva

Instalar Node.js LTS desde:

```text
https://nodejs.org/
```

Durante la instalacion, dejar activada la opcion de agregar Node al PATH.

Luego cerrar y volver a abrir la terminal de VS Code.

Verificar instalacion:

```bash
node -v
npm -v
```

## Instalar dependencias

Desde la terminal de VS Code, entrar a la carpeta del proyecto:

```bash
cd "C:\Users\fredd\Documents\Proyectos\Proyecto Marco\brandtest"
npm install
```

## Correr en desarrollo

Solo frontend:

```bash
npm run dev
```

Abrir la URL que muestre Vite, normalmente:

```text
http://localhost:5173/
```

Frontend + funciones `api/`:

```bash
npm run dev:full
```

Este modo usa Vercel localmente para que funcionen rutas como `/api/analyze-brand`, `/api/consume-credit` y `/api/credit-user`.

## Variables de entorno

Copiar `.env.example` a `.env.local` y completar:

```text
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_SECRET=
```

Estas claves no deben subirse a GitHub.

## Crear build de produccion

```bash
npm run build
```

## Vista previa del build

```bash
npm run preview
```

## Pruebas del motor

`test_engine.js` extrae las funciones puras del motor de análisis directamente
del cuerpo de `initLegacyApp()` en `src/legacy/legacyApp.js` (no una copia
pegada aparte), así que nunca queda desalineado del código real. Correr antes
de cada deploy:

```bash
npm test
```

## Autor

Marco Antonio Ramirez - Gestion de Marca Grafica
