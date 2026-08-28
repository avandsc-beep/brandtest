# BrandTest - Valoracion de Marcas Graficas

Instrumento de valoracion de marcas graficas basado en los indicadores de Chaves y Belluccia.

## Estado del frontend

El proyecto fue migrado a React con Vite manteniendo la interfaz y la logica original del archivo `index.html`.

La migracion actual es una primera version de compatibilidad: React monta el mismo HTML heredado y ejecuta la logica original desde un modulo. Esto permite mantener el producto funcional mientras despues se refactoriza por componentes.

## Estructura

```text
api/                         Funciones del backend
public/                      Archivos publicos de la app
src/App.jsx                  Componente React principal
src/main.jsx                 Entrada de React
src/legacy/legacy.css        Estilos extraidos del HTML original
src/legacy/legacyApp.js      Logica original extraida del HTML
src/legacy/legacyMarkup.js   Marcado original extraido del body
legacy-index.html            Copia del HTML original antes de migrar
index.html                   Entrada de Vite
vite.config.js               Configuracion de Vite
test_engine.js               Pruebas de regresion del motor (node test_engine.js)
```

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
