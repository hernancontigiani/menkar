---
title: Mirá tiempo, tokens y costo
description: Leé cuánto trabajaron tus sesiones, qué usaron y cuánto costaron, y cómo usaste tu propio tiempo.
sidebar:
  order: 1
---

Hacé clic en :ui[header.usage] en el encabezado. La ventana de uso se abre en el proyecto que
muestra la ventana; hacé clic en :ui[usage.allProjects] al pie de su barra izquierda para ver todos
los proyectos. Sus cifras cubren las sesiones de todos los agentes;
[Usá Claude Code, Codex, Cursor u OpenCode](/menkar/es/start/agents/) dice qué informa cada uno.

## Mirá qué usó cada sesión

:ui[usage.section.spend] lista cada proyecto y sus sesiones para hoy, 7 días, 30 días o un mes.

![](shot:usage-spend)

| Columna | Qué cuenta |
|---|---|
| :ui[usage.exec] | El tiempo que el agente trabajó en tus pedidos |
| :ui[usage.blocked] | El tiempo que esperó tu respuesta a un permiso |
| :ui[usage.tokens] | Tokens de entrada, de salida y de caché, cada uno contado una vez |
| :ui[usage.cost] | Lo que cuestan esos tokens a precio de lista de los modelos |

Un costo con `~` es una estimación a precio de lista, no una factura. Un `+` indica un modelo sin
precio conocido. :ui[usage.byDay] muestra las mismas cifras como una barra por día.

El historial guarda cada turno, también después de que Claude Code borra transcripts viejos.

## Mirá tu propio tiempo

:ui[usage.section.time] muestra un día por hora, o una semana: cuándo estuviste trabajando con las
sesiones, los mensajes que mandaste y los permisos que respondiste. Las acciones a menos de 10
minutos una de otra forman una racha, y el tiempo dentro de las rachas es tu tiempo activo. El
tiempo que marcaste como ausente no cuenta.

![](shot:usage-your-time)

Menkar registra esos momentos sin ningún texto: ningún mensaje, ninguna respuesta, ningún título.

## Mirá cuánto tardan las tareas

:ui[usage.section.tasks] muestra, para los proyectos en
[el modo de orquestación](/menkar/es/orchestration/), cuánto tiempo pasaron las tareas en cola, en
curso, esperando y en Para revisar, y a quién esperaron.

## Dividí cada proyecto por etapa

Para ver cada proyecto dividido en planificación, diseño, construcción, prueba, despliegue y
mantenimiento, abrí :ui[header.settings] › :ui[settings.section.usage] y activá
:ui[classifier.switch]. Está apagado hasta que lo activás.

Desde entonces, cada prompt que escribís se manda a Claude Haiku con tu propia cuenta de Claude
Code, junto con tu prompt anterior y los archivos y comandos que usó el agente, y cuenta contra tu
plan. :ui[classifier.earlierButton] clasifica los turnos de antes de activarlo, desde una fecha que
elegís, después de mostrar cuántos turnos va a mandar y una estimación de lo que usan.
