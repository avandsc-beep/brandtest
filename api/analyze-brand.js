// api/analyze-brand.js
// Función de servidor de Vercel. Envía la imagen de la marca a Claude
// (con visión) junto con las métricas reales ya calculadas en el
// navegador (contraste, simetría, complejidad, etc.) como base objetiva,
// y pide la clasificación y el diagnóstico en un formato ESTRUCTURADO
// (tool use), no texto libre — así la respuesta siempre es parseable.
//
// Seguridad: si viene con sesión (usuario con cuenta), se verifica esa
// sesión contra Supabase. Si viene SIN sesión (invitado — decisión
// explícita: la IA está disponible para todos los planes, no solo los
// pagos), se aplica un límite real por IP en el servidor, para que
// nadie pueda automatizar llamadas sin cuenta y sin límite alguno; el
// límite de 48h del navegador para invitados es solo una cortesía de
// UX, no una protección real, así que no basta por sí solo aquí.
//
// Variables de entorno que necesita (se configuran en Vercel, nunca en
// el código ni en GitHub):
//   ANTHROPIC_API_KEY          -> se saca en console.anthropic.com / platform.claude.com
//   SUPABASE_URL                -> el mismo de siempre
//   SUPABASE_SERVICE_ROLE_KEY   -> el mismo de siempre

import { createClient } from "@supabase/supabase-js";

const GUEST_HOURLY_LIMIT = 3;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");

  // Se conserva para atribuir el costo real de IA en ai_usage_events
  // (invitados quedan como null — el gasto igual se registra).
  let requestUserId = null;

  if (token) {
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: "Sesión inválida" });
    }
    requestUserId = user.id;
  } else {
    const ip = (
      (req.headers["x-forwarded-for"] ||
        req.socket?.remoteAddress ||
        "unknown") + ""
    )
      .split(",")[0]
      .trim();
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("guest_analysis_log")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", since);
    if ((count || 0) >= GUEST_HOURLY_LIMIT) {
      return res
        .status(429)
        .json({
          error:
            "Límite de análisis sin cuenta alcanzado por ahora. Crea una cuenta gratis para seguir usando la precisión de IA.",
        });
    }
    await supabaseAdmin.from("guest_analysis_log").insert({ ip });
  }

  const { imageBase64, mediaType, metrics, context } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ error: "Falta la imagen" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res
      .status(500)
      .json({ error: "Falta configurar ANTHROPIC_API_KEY en el servidor" });
  }

  const typologyDefs = `
- logotipo_puro: representación exclusivamente tipográfica, caligráfica o manual del nombre, sin símbolo ni fondo.
- logotipo_con_fondo: el logotipo se inscribe dentro de una figura o superficie de color carente de autonomía identificatoria propia.
- logotipo_con_accesorio: el logotipo se acompaña de un signo menor, decorativo, sin capacidad identificatoria independiente.
- logo_simbolo: texto y símbolo están formalmente fusionados en una sola unidad gráfica indivisible.
- logotipo_con_simbolo: texto y símbolo son, en lo formal, independientes entre sí y cada uno tiene capacidad identificatoria propia, en conjunto o por separado.
- simbolo_solo: solo hay ícono gráfico, sin caracteres tipográficos, con nivel de imposición suficiente para prescindir del nombre escrito.
`.trim();

  const indicatorDefs = `
- calidad_grafica: precisión de trazado, consistencia de grosores, alineación, limpieza visual, calidad de uniones entre formas.
- reproducibilidad: legibilidad a tamaño reducido, funciona en blanco y negro, sin degradados problemáticos, paleta adecuada.
- legibilidad: contraste mínimo 4.5:1, tamaño y grosor adecuados, espaciado correcto, sin interferencias visuales.
- inteligibilidad: forma reconocible, relación ícono-referente clara, sin necesidad de explicación adicional, mensaje directo.
- vocatividad: capacidad de captar la atención en menos de 3 segundos, contraste, elemento distintivo, colores de impacto.
- pregnancia: descripción verbal simple, 1-2 elementos visuales, forma dominante clara, se puede dibujar de memoria.
`.trim();

  const metricsText = metrics
    ? "Métricas reales ya calculadas sobre la imagen (úsalas como base objetiva; si tu lectura visual difiere, explica por qué):\n" +
      "- Contraste fondo/tinta (fórmula WCAG): " +
      metrics.contrast +
      ":1\n" +
      "- Simetría respecto al eje vertical: " +
      metrics.symmetryScore +
      "%\n" +
      "- Complejidad de forma (densidad de bordes): " +
      metrics.edgeComplexity +
      "/100\n" +
      "- Unidades gráficas (componentes conectados) detectadas: " +
      metrics.componentCount +
      "\n" +
      "- Colores en la paleta: " +
      metrics.colorCount +
      "\n" +
      "- Cobertura de tinta sobre el encuadre: " +
      Math.round((metrics.inkRatio || 0) * 100) +
      "%"
    : "";

  const contextText =
    context &&
    (context.brandName ||
      context.sector ||
      context.competitors ||
      context.attributes)
      ? "Contexto proporcionado por el usuario:\n" +
        "- Nombre de marca: " +
        (context.brandName || "no especificado") +
        "\n" +
        "- Sector: " +
        (context.sector || "no especificado") +
        "\n" +
        "- Competencia: " +
        (context.competitors || "no especificada") +
        "\n" +
        "- Atributos de identidad: " +
        (context.attributes || "no especificados")
      : "";

  const systemPrompt =
    "Eres un experto en diseño gráfico y gestión de marca, formado en el marco de indicadores de calidad de Norberto Chaves y Raúl Belluccia. Analizas marcas gráficas (logotipos, símbolos, combinaciones) con el mismo rigor con el que un diseñador senior evaluaría el trabajo de otro.\n\n" +
    "Tipologías marcarias posibles:\n" +
    typologyDefs +
    "\n\n" +
    "Indicadores a evaluar (puntaje de 0 a 100 cada uno):\n" +
    indicatorDefs +
    "\n\n" +
    "Instrucciones:\n" +
    "- Basa tu evaluación en lo que ves en la imagen, apoyándote en las métricas reales ya calculadas cuando estén disponibles.\n" +
    "- Sé específico: cita detalles concretos de la imagen en tus justificaciones (proporciones, contraste, elementos, remates), no frases genéricas que servirían para cualquier marca.\n" +
    "- El diagnóstico debe sonar como la lectura de un profesional del diseño, no como un reporte automatizado.\n" +
    "- Nunca inventes datos que no puedas ver en la imagen o deducir de las métricas provistas.";

  const userText =
    "Analiza esta marca gráfica.\n\n" +
    metricsText +
    (contextText ? "\n\n" + contextText : "");

  const tool = {
    name: "submit_brand_analysis",
    description:
      "Envía el análisis estructurado y completo de la marca gráfica evaluada.",
    input_schema: {
      type: "object",
      properties: {
        typology: {
          type: "string",
          enum: [
            "logotipo_puro",
            "logotipo_con_fondo",
            "logotipo_con_accesorio",
            "logo_simbolo",
            "logotipo_con_simbolo",
            "simbolo_solo",
          ],
        },
        typology_confidence: { type: "integer", minimum: 0, maximum: 100 },
        typology_justification: { type: "string" },
        calidad_grafica: { type: "integer", minimum: 0, maximum: 100 },
        calidad_grafica_justification: { type: "string" },
        reproducibilidad: { type: "integer", minimum: 0, maximum: 100 },
        reproducibilidad_justification: { type: "string" },
        legibilidad: { type: "integer", minimum: 0, maximum: 100 },
        legibilidad_justification: { type: "string" },
        inteligibilidad: { type: "integer", minimum: 0, maximum: 100 },
        inteligibilidad_justification: { type: "string" },
        vocatividad: { type: "integer", minimum: 0, maximum: 100 },
        vocatividad_justification: { type: "string" },
        pregnancia: { type: "integer", minimum: 0, maximum: 100 },
        pregnancia_justification: { type: "string" },
        diagnostic_summary: {
          type: "string",
          description:
            "Párrafo de diagnóstico general en tono profesional de diseño, 3 a 5 frases.",
        },
      },
      required: [
        "typology",
        "typology_confidence",
        "typology_justification",
        "calidad_grafica",
        "calidad_grafica_justification",
        "reproducibilidad",
        "reproducibilidad_justification",
        "legibilidad",
        "legibilidad_justification",
        "inteligibilidad",
        "inteligibilidad_justification",
        "vocatividad",
        "vocatividad_justification",
        "pregnancia",
        "pregnancia_justification",
        "diagnostic_summary",
      ],
    },
  };

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1500,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType || "image/png",
                  data: imageBase64,
                },
              },
              { type: "text", text: userText },
            ],
          },
        ],
        tools: [tool],
        tool_choice: { type: "tool", name: "submit_brand_analysis" },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res
        .status(response.status)
        .json({
          error:
            (data.error && data.error.message) || "Error llamando a Claude",
        });
    }

    // Observabilidad (PARTE 18): registrar el costo REAL de cada análisis
    // en vez de estimarlo. claude-sonnet-5: US$2/M entrada, US$10/M salida.
    // Si este insert falla no debe romper el análisis del usuario.
    if (data.usage) {
      const inputTokens = data.usage.input_tokens || 0;
      const outputTokens = data.usage.output_tokens || 0;
      const { error: usageError } = await supabaseAdmin
        .from("ai_usage_events")
        .insert({
          user_id: requestUserId,
          provider: "anthropic",
          model: data.model || "claude-sonnet-5",
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_usd_estimate: (inputTokens * 2 + outputTokens * 10) / 1e6,
        });
      if (usageError) console.error("ai_usage_events:", usageError.message);
    }

    const toolUse = (data.content || []).find((b) => b.type === "tool_use");
    if (!toolUse) {
      return res
        .status(502)
        .json({
          error: "Claude no devolvió el análisis estructurado esperado",
        });
    }

    return res.status(200).json({ analysis: toolUse.input });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
