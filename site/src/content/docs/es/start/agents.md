---
title: Usá Claude Code, Codex, Cursor u OpenCode
description: Qué hace Menkar con una sesión de cada agente que corre.
sidebar:
  order: 3
---

Menkar corre el comando propio de cada agente en una terminal (`claude` para Claude Code, `codex`
para Codex, `cursor-agent` para Cursor, `opencode` para OpenCode), así que una sesión se comporta
en Menkar como en cualquier terminal, con tu cuenta, tu configuración y tus herramientas. Elegí el
agente cuando [empezás una sesión nueva](/menkar/es/start/first-sessions/#empezá-una-sesión-nueva);
las sesiones que ya tiene cada agente aparecen juntas.

## Elegí un agente para cada sesión

| En Menkar | Claude Code | Codex | Cursor | OpenCode |
|---|---|---|---|---|
| Correr, retomar y cerrar una sesión en una pestaña | Sí | Sí | Sí | Sí |
| El estado de la sesión (:ui[state.working], :ui[state.blocked], :ui[state.idle]) y las notificaciones | Sí | Sí | Sí | Sí |
| Anillo de contexto en cada sesión | Sí | Sí | No | Sí, con un modelo del catálogo de OpenCode |
| Tiempo, tokens y costo en :ui[header.usage] | Sí | Sí | Tiempo y tokens, con :ui[integrations.cursorHooks] activado | Sí |
| [El modo de orquestación](/menkar/es/orchestration/) | Sí | Sí | Sí, como worker, ver [Usá Cursor en el modo de orquestación](#usá-cursor-en-el-modo-de-orquestación) | Sí |
| [Control remoto](/menkar/es/sessions/remote-control/) | Sí | No | No | No |
| Bifurcar una sesión | Sí | No | No | No |
| [Continuar en un chat](/menkar/es/sessions/chat/) | Pide permiso antes de cada edición y comando | No | Solo lectura, o edita y corre comandos sin preguntar | No |

## Usá Cursor en el modo de orquestación

Cursor no puede ser el orquestador: marcá una sesión de Claude Code como orquestador y dale sus
tareas a las sesiones de Cursor como workers.

Abrí :ui[header.settings], elegí Cursor y activá :ui[integrations.cursorHooks] y
:ui[integrations.cursorAllow]. Sin el segundo, Cursor te pregunta antes de que corra cada
herramienta de Menkar. Sin el primero, un mensaje para una sesión de Cursor espera a que esté
inactiva y sin nada escrito en su caja, y entonces Menkar la reinicia con el mensaje; con él, el
mensaje llega apenas termina el turno en curso. Desactivá los dos antes de desinstalar Menkar.

## Mantené el agente al día

Menkar se prueba con una versión de cada agente. Abrí :ui[header.settings] y elegí
:ui[settings.section.about]: en :ui[about.agents] cada agente muestra la versión instalada y con la
que se probó esta versión de Menkar.

Una franja bajo el encabezado te avisa cuando un agente instalado es más viejo de lo que Menkar
necesita, o mucho más nuevo que la versión con la que se probó. Hace falta Claude Code 2.1.267 o
posterior.
