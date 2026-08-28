# BrandTest — Plan de trabajo

**Última actualización:** 27 de agosto de 2026
**Contexto:** Se migró el frontend a Vite + React (extracción 1:1 del `index.html` original, sin componentizar todavía) y se rediseñó visualmente sobre esa base — logo, header, login/landing, sistema de tarjetas y botones, formularios, selector de país. Recién se hizo push a `main`, que dispara el deploy en Vercel.

Este documento junta todo lo que quedó pendiente: lo urgente para confirmar que el deploy no rompió nada, lo que falta del rediseño visual, deuda técnica de la migración, y las decisiones de negocio que ya estaban pendientes antes de esta sesión (roles, monetización).

---

## 0. Urgente — verificar el deploy (hacer primero, antes de seguir tocando código)

- [ ] Confirmar en el dashboard de Vercel que el deploy de `main` corrió y terminó bien (no solo que arrancó).
- [ ] Revisar los **build logs** del deploy — confirmar que detectó Vite (`npm run build` → `dist/`) y no intentó servir el `index.html` viejo como estático plano.
- [ ] Si el build falla o Vercel no lo autodetecta: en el proyecto de Vercel → Settings → Build & Development Settings, fijar manualmente:
  - Framework Preset: `Vite`
  - Build Command: `npm run build` (o `vite build`)
  - Output Directory: `dist`
- [ ] Confirmar que las funciones de `api/*.js` siguen resolviendo (`/api/analyze-brand`, `/api/consume-credit`, etc.) — ahora están en sintaxis ESM, Vercel debería tomarlas igual, pero conviene probar una real.
- [ ] Revisar que las variables de entorno de producción sigan intactas: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SECRET`. (Recordatorio de tu propia memoria técnica: si alguna da un error raro tipo "debería estar bien", bórrala y créala de nuevo antes de asumir un bug de código.)
- [ ] Decidir si se configura `ANTHROPIC_API_KEY` ahora (sigue "Pendiente" según la memoria técnica) — sin ella el análisis cae automáticamente al motor de reglas, no rompe nada, pero no hay capa de IA.

### Smoke test en producción real (no en local)

- [ ] Login con Google real (no invitado).
- [ ] Flujo de invitado ("Probar sin registrarme").
- [ ] Subir una imagen y correr un análisis completo de punta a punta.
- [ ] Exportar el informe (PDF / impresión) — confirmar que el CSS de impresión no se vio afectado por los cambios visuales.
- [ ] Panel de admin (si tenés `is_admin=true` en tu usuario): las 3 pestañas, banco de calibración, interruptor de estadísticas públicas.
- [ ] Modal "Mi cuenta": guardar WhatsApp con el selector de país nuevo, solicitar créditos.
- [ ] Revisar en el celular real (no solo devtools) — especialmente el menú lateral y el selector de país.

---

## 1. Rediseño visual — lo que falta

Lo que ya se hizo: logo (modo claro/oscuro), header con menú de cuenta, login/landing como hero, sección de Planes separada, sistema de tarjetas y botones con sombra dura de color, formularios, modal "Mi cuenta", selector de país.

Lo que **todavía tiene el look viejo** (no recibió el tratamiento nuevo):

- [ ] **Pantalla de resultados**: gráfico radar, barras por categoría, indicadores individuales, sello de veredicto — revisar si necesitan el mismo lenguaje de sombra dura / color.
- [ ] **Panel de administrador**: las 3 pestañas (Créditos, Valoración de Marca, Métricas), tarjetas de estadísticas.
- [ ] **Modales secundarios**: cámara, recorte de imagen (`cropModal`), tipología (selección manual).
- [ ] **Selector de tipología marcaria** en el flujo principal (las 6 tarjetas "Logotipo Puro", "Logotipo con Fondo", etc.) — mismo tipo de mejora que se le hizo al selector de país.
- [ ] **Notificaciones/toasts** (`.notification`) — siguen con sombra suave genérica.
- [ ] Revisar consistencia general en modo claro (todo se probó mayormente pensando en oscuro).

---

## 2. Deuda técnica de la migración a Vite

- [ ] **Componentizar de verdad `src/legacy/*`**. Hoy sigue siendo el mismo HTML/CSS/JS monolítico de siempre, solo repartido en 3 archivos e inyectado entero con `dangerouslySetInnerHTML`. Vite no está aportando ningún beneficio real de mantenibilidad todavía — el beneficio llega recién cuando esto se parte en componentes React reales con props y estado.
- [ ] **Code-splitting**: Vite avisa que el bundle final pesa ~570KB. Se puede mejorar con `import()` dinámico o `manualChunks` en `vite.config.js`.
- [ ] Decidir si `legacy-index.html` (la copia de referencia del HTML original) se mantiene en el repo indefinidamente o se puede borrar una vez que el equipo confíe en la migración.

---

## 3. Roles y monetización (pendiente de antes de esta sesión)

Ver `roles-y-monetizacion.md` para el contexto completo. Decisiones que faltan tomar:

- [ ] Cantidad exacta de créditos por plan (el doc propone Estudiante/Profesional/Empresa con rangos de precio, pero no está cerrado).
- [ ] Si los créditos no usados se acumulan o vencen.
- [ ] Si todos los análisis cuestan 1 crédito o si algunos (ej. con IA) cuestan más.
- [ ] Funciones exactas de cada rol (estudiante / profesional / empresa).
- [ ] Procesador de pagos — la recomendación del doc es Stripe.
- [ ] Cómo se manejan cuentas empresariales con varios usuarios.
- [ ] **Sistema de perfiles de usuario** (estudiante/profesional/emprendedor): ya está especificado conceptualmente en la memoria técnica — la capa de interpretación va separada del motor de análisis, nunca debe tocar los números que ya calcula. No implementado.

**Nota de arquitectura**: la implementación técnica debería empezar por el sistema de créditos (ya existe parcialmente: `credits`, `plan`, `credit_usage_log`, `credit_history` en la base de datos) antes de conectar cobranza real.

---

## 4. Otros pendientes conocidos (de la memoria técnica, sin tocar en esta sesión)

- [ ] **APK / Google Play**: la app ya es PWA instalable. Empaquetarla con PWABuilder (TWA) para publicarla en Play Store — no requiere reescribir nada.
- [ ] **Activar estadísticas públicas**: el mecanismo ya existe (interruptor en Métricas + `api/public-stats.js`), se recomendó no activarlo hasta tener números convincentes.
- [ ] Conseguir el libro *Tipologías Marcarias* (Chaves + Espinosa, 2022) para refinar la detección de tipología.
- [ ] Contacto con Raúl Belluccia (coautor vivo del marco teórico) como paso de validación.

---

## Cómo usar este documento

Marcá los checkboxes a medida que se van resolviendo. Cuando se cierre una sección entera, actualizá también `brandtest_memoria_tecnica.md` si la decisión afecta la arquitectura o el esquema de datos — ese documento es la referencia técnica permanente, este es la lista de tareas del momento.
