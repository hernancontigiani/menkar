---
title: Usá Claude Code o Cursor
description: Qué hace Menkar con una sesión de Claude Code y con una de Cursor.
sidebar:
  order: 3
---

Menkar corre el comando propio de cada agente en una terminal, `claude` para Claude Code y
`cursor-agent` para Cursor, así que una sesión se comporta en Menkar como en cualquier terminal,
con tu cuenta, tu configuración y tus herramientas. Elegí el agente cuando
[empezás una sesión nueva](/menkar/es/start/first-sessions/#empezá-una-sesión-nueva); las sesiones
que ya tienen los dos agentes aparecen juntas.

## Elegí un agente para cada sesión

| En Menkar | Claude Code | Cursor |
|---|---|---|
| Correr, retomar y cerrar una sesión en una pestaña | Sí | Sí |
| El estado de la sesión (:ui[state.working], :ui[state.blocked], :ui[state.idle]) y las notificaciones | Sí | Sí |
| Anillo de contexto en cada sesión | Sí | No |
| Tiempo, tokens y costo en :ui[header.usage] | Sí | No |
| [El modo de orquestación](/menkar/es/orchestration/) | Sí | No |
| [Control remoto](/menkar/es/sessions/remote-control/) | Sí | No |
| Bifurcar una sesión | Sí | No |
| [Continuar en un chat](/menkar/es/sessions/chat/) | Pide permiso antes de cada edición y comando | Solo lectura, o edita y corre comandos sin preguntar |

## Mantené el agente al día

Menkar se prueba con una versión de cada agente. Abrí :ui[header.settings] y elegí
:ui[settings.section.about]: en :ui[about.agents] cada agente muestra la versión instalada y con la
que se probó esta versión de Menkar.

Una franja bajo el encabezado te avisa cuando un agente instalado es más viejo de lo que Menkar
necesita, o mucho más nuevo que la versión con la que se probó. Hace falta Claude Code 2.1.267 o
posterior.
