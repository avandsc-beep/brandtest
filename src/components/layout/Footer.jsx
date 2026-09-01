// Versión simplificada del crédito de marca fijo del colaborador
// (.app-footer): acá en flujo normal (no fixed) para no tapar contenido
// ni competir con el header fijo, pero con el mismo tono breve — no el
// footer de 4 columnas tipo landing de marketing que tenía antes.
export function Footer() {
  return (
    <footer className="border-t border-outline-variant mt-10 py-6 text-center text-xs text-on-surface-variant print:hidden">
      <p>© {new Date().getFullYear()} BRANDEX — Validación de Marcas Gráficas.</p>
      <p className="mt-1">Autor: Marco Antonio Ramírez · Gestión de Marca Gráfica</p>
      {/* Páginas legales estáticas (public/*.html) — requisito de la
          verificación de sitio de Paddle, por eso son <a> reales y no
          vistas del SPA. */}
      <p className="mt-3 flex justify-center gap-4 flex-wrap">
        <a href="/terminos.html" className="hover:text-process-cyan transition-colors">Términos y Condiciones</a>
        <a href="/privacidad.html" className="hover:text-process-cyan transition-colors">Privacidad</a>
        <a href="/reembolsos.html" className="hover:text-process-cyan transition-colors">Reembolsos</a>
      </p>
    </footer>
  );
}
