# BrandTest — Memoria técnica del proyecto
**Para:** cualquier colaborador que continúe el desarrollo
**Estado:** en producción, con usuarios reales — `https://brandtest-zeta.vercel.app`
**Última actualización de este documento:** agosto 2026 (migración a Vite/React documentada más abajo)
**Propietario del producto:** Marco Antonio Ramírez (diseñador gráfico, docente, AVAND — Gestión de Marca Gráfica)

---

## 1. Qué es esto, en dos frases

BrandTest mide técnicamente la calidad de una marca gráfica (logotipo, símbolo o combinación) a partir del marco de indicadores de Norberto Chaves y Raúl Belluccia (*La marca corporativa*, 2003). El motor combina matemática real sobre la imagen (color, contraste, geometría) con — cuando hay llave de API configurada — un modelo de Claude con visión, sin caja negra: cada puntaje cita el método real detrás.

---

## 2. Arquitectura, de un vistazo

> **Migración en curso (agosto 2026):** el proyecto pasó de un `index.html`
> monolítico sin build step a Vite + React. La lógica y el diseño no
> cambiaron — se extrajeron tal cual a `src/legacy/` — pero el frontend ahora
> sí tiene un paso de build. Ver la sub-sección "Migración a Vite" para el
> detalle completo.

```
Frontend: Vite + React. El HTML/CSS/JS heredado vive en src/legacy/ y se monta
          entero vía dangerouslySetInnerHTML — no son componentes reales
          todavía, es el mismo código de siempre, solo repartido en 3 archivos.
Backend:  Supabase (Postgres + Auth con Google OAuth + Storage) + funciones
          de servidor en Vercel (Node.js/ESM, carpeta api/).
Hosting:  Vercel, desplegado directo desde GitHub (push a main = deploy,
          ahora con un paso de build: vite build -> dist/).
IA:       Anthropic API (Claude, con visión), llamada desde api/analyze-brand.js.
```

Vercel detecta el framework Vite automáticamente por la presencia de `vite.config.js` y el script `build` en `package.json` (no hace falta `vercel.json`). Las funciones en `api/*.js` se siguen detectando automáticamente como serverless — ahora en sintaxis ESM (`import`/`export default`), porque `package.json` tiene `"type": "module"` para Vite.

### Migración a Vite — qué cambió y por qué

- **Motivo**: dejar la puerta abierta a componentizar de verdad más adelante (hoy `src/legacy/*` sigue siendo el mismo monolito de antes, solo repartido — no hay beneficio de mantenibilidad todavía, eso es trabajo futuro).
- **`index.html`** dejó de ser la app entera y pasó a ser el punto de entrada de Vite (`<div id="root">` + `<script type="module" src="/src/main.jsx">`). El HTML/CSS/JS original se conserva en `legacy-index.html` como referencia histórica.
- **`src/legacy/legacyMarkup.js`, `legacy.css`, `legacyApp.js`**: el body, los estilos y el script del `index.html` original, extraídos tal cual. `src/App.jsx` inyecta el markup con `dangerouslySetInnerHTML` y llama a `initLegacyApp()` una sola vez en un `useEffect`.
- **`src/main.jsx`** reemplaza los `<script>` de CDN que tenía el `index.html` original (Supabase JS, Cropper.js): ahora se importan como dependencias npm (`@supabase/supabase-js`, `cropperjs`) y se asignan a `window.supabase` / `window.Cropper` para que el código heredado (que sigue usando esos globales) siga funcionando sin tocarlo.
- **`api/*.js`** se convirtieron de CommonJS (`require`/`module.exports`) a ESM (`import`/`export default`) — con `"type": "module"` en `package.json`, Vercel las ejecuta como ESM y la sintaxis vieja rompía en runtime.
- **`test_engine.js`** se movió de `api/` a la raíz (para que Vercel no lo detecte como función serverless) y ahora extrae las funciones puras del cuerpo de `initLegacyApp()` en `src/legacy/legacyApp.js`, en vez del `<script>` de `index.html`. Sigue siendo el mismo arnés de pruebas, misma cantidad de casos.

### Inventario de archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | Punto de entrada de Vite (antes era la app completa). |
| `legacy-index.html` | Copia de referencia del `index.html` original, previo a la migración. |
| `src/App.jsx`, `src/main.jsx` | Monta el markup heredado y cablea las dependencias globales (Supabase, Cropper) que el código viejo espera. |
| `src/legacy/legacyMarkup.js` | El `<body>` original, extraído tal cual. |
| `src/legacy/legacy.css` | Los estilos originales, extraídos tal cual. |
| `src/legacy/legacyApp.js` | La lógica original (motor de análisis, UI, auth), extraída tal cual dentro de `initLegacyApp()`. |
| `vite.config.js` | Configuración de Vite (plugin de React). |
| `package.json` | Dependencias npm + scripts (`dev`, `build`, `test`, etc.) — `"type": "module"`. |
| `api/consume-credit.js` | Verifica sesión real y descuenta créditos de forma segura (server-side). |
| `api/credit-user.js` | Acredita créditos manualmente (admin), protegido por `ADMIN_SECRET`. |
| `api/analyze-brand.js` | Llama a Claude (visión) para el análisis con IA. Sesión requerida para cuentas; límite por IP para invitados. |
| `api/get-recognition-sample.js` | Entrega una muestra al azar del banco de calibración para el test de reconocimiento (sin revelar la respuesta). |
| `api/submit-recognition.js` | Recibe la respuesta del test, la valida, acredita 1 crédito. |
| `api/public-stats.js` | Estadísticas públicas para la pantalla de login (solo si el admin las activó). |
| `test_engine.js` | Arnés de pruebas del motor matemático (ahora en la raíz, ESM) — **correr antes de cada deploy**: `npm test`. |
| `supabase_schema.sql` (en `api/`) | Todo el esquema de base de datos, en orden cronológico (`PARTE 1` a `PARTE 15` al día de hoy). Ver sección 4. |
| `public/manifest.json`, `public/service-worker.js`, `public/icons/` | PWA — la app es instalable desde el navegador. Vite copia todo `public/` a la raíz del build. |

---

## 3. Variables de entorno (Vercel → Settings → Environments → Production)

| Variable | Para qué | Estado |
|---|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase | Configurada |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave de servicio (bypassa RLS) — solo la usan las funciones de `api/` | Configurada |
| `ADMIN_SECRET` | Contraseña para acreditar créditos desde el panel admin | Configurada |
| `ANTHROPIC_API_KEY` | Llave de la API de Claude | **Pendiente** — sin esta, el análisis cae automáticamente al motor de reglas (no rompe nada, solo pierde la capa de IA) |

**Advertencia real, ya vivida en este proyecto**: Vercel rediseñó la pantalla de variables de entorno a mitad de este desarrollo, y dos variables (`SUPABASE_URL`, `ADMIN_SECRET`) quedaron "viejas"/no aplicadas tras el cambio, causando errores confusos (`supabaseUrl is required`, `No autorizado`) que solo se resolvieron borrando y recreando la variable. Si algo falla con un error que menciona una variable que "debería estar bien", **bórrala y créala de nuevo** antes de asumir un bug de código.

---

## 4. Base de datos — cómo está organizada y por qué

`supabase_schema.sql` no es un esquema estático: es un **registro cronológico aditivo**. Cada "PARTE" documenta una decisión y cuándo se tomó. Al incorporarse al proyecto, un colaborador nuevo debería correr el archivo completo de una sola vez contra un proyecto Supabase nuevo; si es sobre el proyecto existente, cada bloque tiene `if not exists` donde aplica, así que es seguro re-correr todo.

### Tablas principales

- **`users`** — perfil de cada usuario autenticado. `credits`, `plan`, `total_analyses`, `last_free_analysis` y `is_admin` están **protegidas a nivel de columna** (`revoke update ... from authenticated`) — ni el propio dueño de la fila puede tocarlas desde el navegador. Solo las funciones de servidor (service role) pueden.
- **`credit_history`** — log de créditos otorgados por el admin.
- **`credit_usage_log`** — log de créditos gastados en análisis.
- **`diagnosis_history`** — historial personal de cada usuario. Guarda el resultado completo (`results_json`) y la imagen (`image_path`, en el bucket `diagnosis-images`, privado por carpeta de usuario) — es reconstruible, no solo un resumen de texto.
- **`calibration_samples`** — banco de calibración (solo admin escribe). Imagen + tipología real + los 6 indicadores + color percibido + puntaje holístico + confianza, todo puesto a mano por un evaluador experto. Es la verdad de referencia (*ground truth*) del proyecto.
- **`recognition_responses`** — respuestas de usuarios al test de reconocimiento, con restricción `unique(sample_id, user_id)` para que nadie repita una muestra y se regale créditos.
- **`app_settings`** — fila única, config pública (hoy solo `show_public_stats`).
- **`guest_analysis_log`** — solo IP + fecha, para limitar el análisis con IA de invitados (3/hora). Sin políticas de cliente a propósito: solo el service role la toca.

### La función `is_admin_user()` — importante entender esto

Varias políticas necesitan preguntar "¿este usuario es admin?". La primera versión de eso preguntaba directo dentro de una política **de la propia tabla `users`**, lo cual causaba **recursión infinita en Postgres** (la política se preguntaba a sí misma) y rompía silenciosamente el panel admin completo — nadie podía ver que era admin, ni siquiera el admin real. La solución (PARTE 10) fue una función `security definer` que se salta las políticas de seguridad *solo para esa consulta puntual*:

```sql
create or replace function public.is_admin_user() returns boolean
language sql security definer stable as $$
  select coalesce((select is_admin from public.users where id = auth.uid()), false);
$$;
```

**Cualquier política nueva que necesite verificar "es admin" debe usar `public.is_admin_user()`, nunca una subconsulta directa a `users` dentro de una política de `users` mismo.**

---

## 5. El motor de análisis — lo que hay que entender antes de tocarlo

`analyzeImage()` procesa la imagen en un canvas 100×100, hace flood fill para detectar componentes conectados, calcula contraste (WCAG), simetría, densidad de bordes, y construye la paleta de color.

### Color — fusión perceptual, no cuantización ingenua

Los colores no se cuentan por cercanía numérica en RGB — se convierten a espacio **CIE Lab** y se fusionan por distancia perceptual (ΔE), porque el ruido de una foto de cámara dispersa un solo color real en muchas variaciones. El umbral de fusión **depende del origen de la imagen** (`imageSource`, `'camera'` o `'upload'`): cámara usa ΔE=7 (absorbe ruido fotográfico real), archivo subido usa ΔE=3 (fiel al conteo real, un logo exportado no tiene ese ruido).

### Conteo de componentes — bruto vs. efectivo

`d.componentCount` es el conteo bruto (cada letra, cada punto de "i" suelto, cuenta aparte). Esto es correcto para medir consistencia de trazo (Calidad Gráfica compara letra por letra a propósito) pero **incorrecto** para Inteligibilidad y Pregnancia — un nombre largo no debería penalizarse por tener muchas letras. Por eso existe `d.effectiveComponentCount = (hay texto ? 1 : 0) + cantidad de elementos no-texto` — el bloque de texto cuenta como una sola unidad conceptual, sin importar su largo.

### El veto de indicadores ("gate")

`calculateOverall(scores)` no es un promedio simple. Si cualquiera de 5 de los 6 indicadores (todos menos Vocatividad) cae muy bajo, el puntaje general queda topado en `peor_indicador + 20`, sin importar qué tan bien salgan los demás. Esto existe porque se encontró un caso real: una marca con exceso de color y efectos sacaba ~90% porque los otros 5 indicadores compensaban un Reproducibilidad hundido en el promedio. **Vocatividad queda fuera del veto a propósito** — el libro de Chaves y Belluccia (sección 2.12) es explícito en que su nivel "correcto" depende del contexto de cada marca (Mercedes-Benz es poco vocativa y es una marca excelente), así que un puntaje alto ahí no debe poder tapar fallas reales en otro lado.

### Los 6 indicadores implementados (de 14 totales del marco teórico)

Calidad Gráfica Genérica, Reproducibilidad, Legibilidad, Inteligibilidad, Vocatividad, Pregnancia. Los otros 8 (Suficiencia, Vigencia, Ajuste tipológico, Corrección estilística, Compatibilidad semántica, Versatilidad, Singularidad, Declinabilidad) no están implementados — varios requieren contexto de mercado que no viene de una sola imagen. Esto se declara explícitamente en la propia interfaz.

### Tipología marcaria

6 tipos: logotipo puro, logotipo con fondo, logotipo con accesorio, logo-símbolo, logotipo con símbolo, símbolo solo. Detección automática (`detectTypologyReal`) vía árbol de decisión sobre `textGroup` (componentes que se comportan como texto) y `extras` (el resto). Corregible manualmente por el usuario — cada corrección queda registrada (predicho vs. corregido) para calibración futura.

### La capa de IA (Claude), cuando hay llave configurada

`callClaudeAnalysis(d)` manda la imagen real + las métricas objetivas ya calculadas (no reemplaza el motor de reglas, lo complementa) a `api/analyze-brand.js`, que fuerza la respuesta de Claude a un formato estructurado (tool use, no texto libre) citando los mismos 6 indicadores y 6 tipologías. Si la llamada falla por cualquier motivo (sin llave, red caída), cae automáticamente al motor de reglas — el usuario nunca ve un error por esto.

**Decisión de negocio ya tomada**: la IA está disponible en todos los planes, incluidos Libre e invitados (no restringida a planes pagos) — decisión explícita del propietario del producto, no un descuido.

---

## 6. Flujos de usuario

- **Invitado** (sin cuenta): 1 análisis gratis cada 48h (límite en `localStorage`, cortesía de UX, no seguridad real). La IA para invitados SÍ tiene protección real del lado del servidor: 3/hora por IP (`guest_analysis_log`).
- **Registrado** (Google OAuth vía Supabase): 10 créditos de bienvenida (trigger SQL automático al crear cuenta), plan Libre (1 cada 12h) o créditos (Estándar=10, Pro=20 por análisis).
- **Admin** (`is_admin=true`, marcado a mano en SQL — no hay UI para auto-otorgarse esto): uso ilimitado, panel con 3 pestañas (Créditos / Valoración de Marca / Métricas), banco de calibración, interruptor de estadísticas públicas.

---

## 7. Identidad visual (rediseño reciente)

- **Tipografía**: `Big Shoulders Display` (títulos, condensada/industrial — deliberadamente distinta de fuentes sobreusadas como Space Grotesk) + `IBM Plex Mono` (datos/métricas) + `IBM Plex Sans` (cuerpo).
- **Paleta**: fondo casi negro (`--bg: #15130F`), acentos cian/magenta/amarillo con significado real (referencian CMY de la cuatricromía de impresión, con el fondo oscuro haciendo de "K"). Modo claro disponible (`data-theme="light"`, usa `#FFFAE5`, no blanco puro).
- **Elemento de firma**: el veredicto del análisis se muestra como un **sello circular girado** ("Aprobado" / "Ajuste leve" / "Revisar" / "Rediseño"), rompiendo el borde de la tarjeta de puntaje — referencia directa al sello de aprobación de una prueba de imprenta.
- **Motivo recurrente**: la mira de registro de imprenta (crosshair rotando) como ícono de marca; una tira de control de color CMYK como divisor bajo el header.

---

## 8. Cómo probar antes de cada cambio

```bash
npm test   # node test_engine.js — pruebas del motor matemático, deben pasar siempre
```

El arnés extrae el cuerpo de `initLegacyApp()` en `src/legacy/legacyApp.js` con una expresión regular y lo ejecuta con un stub mínimo de `document`/`window` — así nunca queda desalineado del código real en producción. Cualquier función matemática nueva del motor debería agregarse tanto al archivo principal como a la lista de exportaciones al final del bloque de pruebas, con casos de prueba reales, no solo "no debe dar NaN".

Antes de publicar, conviene validar que el build de Vite compile limpio:
```bash
npm run build
```

Si algo del markup heredado (`src/legacy/legacyMarkup.js`) se edita a mano — es un único string JS gigante, generado originalmente con `JSON.stringify` — conviene verificar sintaxis rápido antes de commitear:
```bash
node --check src/legacy/legacyMarkup.js
node --check src/legacy/legacyApp.js
```

---

## 9. Lo que quedó pendiente / próximos pasos conocidos

- **Componentizar de verdad `src/legacy/*`**: la migración a Vite (agosto 2026) movió el código, no lo rediseñó — sigue siendo el mismo HTML/CSS/JS monolítico de siempre, ahora repartido en 3 archivos e inyectado con `dangerouslySetInnerHTML`. El paso siguiente, cuando haya tiempo de hacerlo bien, es partirlo en componentes React reales con props y estado — recién ahí Vite empieza a pagar su costo de build.
- **Sistema de perfiles de usuario** (estudiante / profesional / emprendedor): especificado en detalle (arquitectura de capa de interpretación separada del motor, ya aprobada conceptualmente), **no implementado todavía**. El diseño ya está resuelto: el perfil nunca debe tocar el motor de análisis, solo la presentación/interpretación de los mismos números.
- **APK / Google Play**: la app es PWA instalable. El siguiente paso (no iniciado) sería envolverla con PWABuilder (TWA) para publicarla en Play Store — no requiere reescribir nada, es un empaquetado delgado sobre lo que ya existe.
- **Estadísticas públicas**: el mecanismo ya está construido (interruptor en Métricas + `api/public-stats.js`), pero se recomendó no activarlo hasta tener números genuinamente convincentes.
- **Libro "Tipologías Marcarias" (Chaves + Espinosa, 2022)**: identificado como fuente que podría refinar la detección de tipología, pero no se consiguió una edición digital — pendiente de que el propietario lo compre físico o encuentre otra vía.
- **Contacto con Raúl Belluccia** (coautor vivo del marco teórico): sugerido como paso de validación/legitimidad, no ejecutado todavía. (Norberto Chaves falleció en diciembre de 2024 — no es un contacto posible.)

---

## 10. Fuente teórica primaria

El libro completo *La marca corporativa* (Chaves y Belluccia, 2003) está disponible como `.md` en la conversación de desarrollo (subido por el propietario). Cualquier cambio a un indicador o a la tipología debería consultarse contra el texto real, no contra paráfrasis de memoria — así se encontró y corrigió el diseño original del veto de Vocatividad.

---

*Documento de memoria técnica — mantenerlo actualizado cada vez que se agregue una PARTE nueva al esquema SQL o se tome una decisión de arquitectura que un colaborador futuro necesitaría conocer antes de tocar el código.*
