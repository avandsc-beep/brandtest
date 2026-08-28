# Roles y Monetizacion de BrandTest

Este documento resume el contexto necesario para definir los roles comerciales de BrandTest y tomar decisiones de implementacion sobre planes, creditos, suscripciones y cobranza.

## Objetivo

Definir como funcionaran los roles de estudiantes, profesionales y empresas dentro de BrandTest para poder convertir el proyecto en un producto vendible, escalable y facil de cobrar.

BrandTest debe poder controlar el uso de analisis con IA, diferenciar beneficios por tipo de usuario y ofrecer planes comerciales claros.

## Prompt para pedir contexto al equipo

Enviar este mensaje al companero del proyecto:

```text
Hola, necesito que definamos bien como van a funcionar los roles dentro del proyecto BrandTest para poder estructurar el producto, la venta y la monetizacion.

La idea es que me ayudes a aclarar estos puntos:

1. Rol Estudiante
- Que podra hacer un estudiante dentro de la plataforma?
- Tendra analisis gratuitos o limitados?
- Que tipo de resultados podra ver?
- Podra guardar historial de analisis?
- Tendra acceso a herramientas completas o una version reducida?
- Que precio tendria sentido para estudiantes?

2. Rol Profesional
- Que diferencia tendra frente al estudiante?
- Cuantos analisis podra hacer?
- Podra descargar reportes?
- Podra guardar proyectos o marcas?
- Tendra mejores metricas, historial, exportaciones o recomendaciones avanzadas?
- Este rol seria para disenadores, marketers, freelancers o consultores?

3. Rol Empresa
- Que funcionalidades empresariales necesita?
- Varios usuarios por cuenta?
- Historial compartido?
- Reportes para equipos?
- Gestion de marcas/clientes?
- Mayor cantidad de creditos o analisis?
- Soporte prioritario?
- Panel administrativo?
- Precio mensual alto o plan personalizado?

4. Modelo de negocio
- Queremos vender por suscripcion mensual, por tokens/creditos, o una combinacion?
- Cuantos analisis deberia incluir cada plan?
- Que limites tendria cada usuario?
- Que funcionalidades serian premium?
- Como evitamos que un usuario abuse del sistema usando IA sin pagar?

5. Casos de uso reales
- Dame ejemplos concretos de como usaria BrandTest:
  - un estudiante,
  - un disenador freelance,
  - una agencia,
  - una empresa grande.

La respuesta ideal seria en formato tabla con: rol, usuario objetivo, funcionalidades, limites, beneficios, precio sugerido y observaciones.
```

## Recomendacion de modelo comercial

La mejor opcion para BrandTest es un modelo hibrido:

- Suscripcion mensual como base.
- Creditos incluidos en cada plan.
- Compra adicional de paquetes de creditos cuando el usuario agote sus analisis.

Este modelo combina ingresos recurrentes con control del costo de IA.

## Por que no usar solo suscripcion

Una suscripcion mensual pura puede ser peligrosa si el usuario tiene uso ilimitado, porque cada analisis puede tener costo real por consumo de IA, almacenamiento, procesamiento de imagenes y base de datos.

Si un usuario paga poco y analiza demasiado, el producto puede perder dinero.

## Por que no usar solo tokens

Un modelo solo por tokens puede ser mas dificil de vender al inicio, porque el usuario siente que esta pagando cada accion. Tambien reduce la previsibilidad de ingresos.

Los tokens funcionan mejor como complemento, no como unico modelo.

## Modelo recomendado

Cada plan mensual debe incluir una cantidad de creditos. Cada analisis consume creditos. Si el usuario necesita mas, compra creditos extra.

Ejemplo inicial:

| Plan | Usuario objetivo | Precio sugerido | Creditos incluidos | Beneficios principales |
| --- | --- | ---: | ---: | --- |
| Estudiante | Estudiantes de diseno, marketing o branding | USD 5-9/mes | 10 analisis/mes | Acceso basico, resultados principales, historial limitado |
| Profesional | Freelancers, disenadores, marketers, consultores | USD 19-29/mes | 50 analisis/mes | Historial completo, reportes, mejores recomendaciones, proyectos |
| Empresa | Agencias, equipos de marketing, empresas | USD 79-199/mes | 300+ analisis/mes | Usuarios multiples, creditos compartidos, reportes, panel administrativo |
| Creditos extra | Cualquier plan pago | Variable | 10, 50 o 100 creditos | Permite seguir usando la plataforma sin cambiar de plan |

## Roles del producto

### Estudiante

Pensado para usuarios que estan aprendiendo branding, diseno, comunicacion visual o marketing.

Funciones sugeridas:

- Analizar una cantidad limitada de marcas o piezas visuales.
- Ver resultados principales.
- Acceder a recomendaciones basicas.
- Guardar historial limitado.
- No acceder a reportes avanzados o funciones empresariales.

Objetivo comercial:

- Precio bajo.
- Facil entrada al producto.
- Convertir usuarios jovenes en profesionales pagos a futuro.

### Profesional

Pensado para disenadores, marketers, freelancers, consultores y pequenos estudios.

Funciones sugeridas:

- Mayor cantidad de analisis mensuales.
- Historial completo.
- Guardar proyectos o marcas.
- Descargar reportes.
- Acceder a recomendaciones mas detalladas.
- Comparar resultados entre distintas versiones de una marca o pieza.

Objetivo comercial:

- Ser el plan principal de venta.
- Tener el mejor balance entre precio, valor y costo operativo.
- Convertirse en el plan recomendado.

### Empresa

Pensado para agencias, equipos de marketing, departamentos de marca y empresas con varios usuarios.

Funciones sugeridas:

- Usuarios multiples por cuenta.
- Creditos compartidos entre el equipo.
- Historial compartido.
- Reportes descargables.
- Gestion de clientes, marcas o proyectos.
- Panel administrativo.
- Soporte prioritario.
- Posible precio personalizado para cuentas grandes.

Objetivo comercial:

- Mayor ticket mensual.
- Mejor margen.
- Producto mas robusto para equipos.

## Implementacion tecnica recomendada

La implementacion deberia empezar con un sistema interno de creditos porque es la forma mas simple de controlar el costo real de los analisis.

Flujo recomendado:

1. Cada usuario tiene un rol o plan activo.
2. Cada plan entrega una cantidad de creditos mensuales.
3. Cada analisis consume 1 credito o mas, dependiendo del tipo de analisis.
4. Si el usuario no tiene creditos, se bloquea el analisis y se muestra opcion de mejorar plan o comprar creditos.
5. Al renovar la suscripcion mensual, se recargan los creditos incluidos del plan.
6. Los creditos extra comprados pueden acumularse o vencer segun la estrategia comercial.

## Datos que conviene guardar en base de datos

Campos sugeridos para usuarios:

```text
user_id
email
role
plan
credits_balance
monthly_credits
subscription_status
subscription_provider
subscription_id
current_period_start
current_period_end
created_at
updated_at
```

Campos sugeridos para movimientos de creditos:

```text
id
user_id
type
amount
reason
related_analysis_id
created_at
```

Ejemplos de `type`:

```text
monthly_renewal
analysis_consumed
credits_purchase
manual_adjustment
refund
```

## Cobranza recomendada

La mejor opcion para cobranza es usar Stripe o un proveedor equivalente que permita:

- Suscripciones mensuales.
- Compra de paquetes de creditos.
- Webhooks para actualizar el estado de pago.
- Facturacion automatica.
- Planes por producto.
- Cancelaciones y renovaciones.

Stripe deberia comunicar los cambios de pago al backend mediante webhooks. El backend actualiza el plan, estado de suscripcion y creditos del usuario.

## Decisiones pendientes

Antes de implementar, el equipo debe definir:

- Cantidad exacta de creditos por plan.
- Si los creditos no usados se acumulan o vencen.
- Si todos los analisis cuestan 1 credito o si algunos analisis avanzados cuestan mas.
- Que funciones exactas tiene cada rol.
- Que limite tendran los usuarios gratuitos, si existe plan gratuito.
- Que procesador de pagos se usara.
- Como se manejaran cuentas empresariales con varios usuarios.

## Conclusion

Para BrandTest, la mejor estrategia es vender suscripciones mensuales con creditos incluidos y permitir compras adicionales de creditos.

Este modelo ayuda a:

- Generar ingresos recurrentes.
- Controlar el costo de IA.
- Crear planes claros para estudiantes, profesionales y empresas.
- Facilitar la cobranza.
- Escalar el producto sin regalar uso ilimitado.

La primera etapa de implementacion deberia enfocarse en roles, planes, saldo de creditos y consumo por analisis. Luego se puede conectar la cobranza con Stripe y automatizar renovaciones.
