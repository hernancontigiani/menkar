---
title: Continuá una sesión en un chat
description: Retomá una sesión anterior en una pestaña de chat que pregunta antes de editar o correr algo, o en Ghostty.
sidebar:
  order: 5
---

## Continuá una sesión en una pestaña de chat

1. Abrí :ui[sidebar.addSession] y quedate en :ui[add.existing].
2. Hacé clic derecho en la sesión y elegí :ui[chat.continueSole]. Una sesión de Cursor ofrece dos
   chats: :ui[chat.modeAskReadOnly] y :ui[chat.modeTrustedAutoRun].
3. Escribí en el cuadro de abajo y apretá `Enter`.

El chat continúa la conversación de la sesión; sus mensajes anteriores no se muestran en la
pestaña.

## Respondé lo que pregunta la sesión

Un chat de Claude Code se detiene antes de cada edición de un archivo y de cada comando, y muestra
una tarjeta.

![](shot:chat-permission)

- :ui[chat.allowOnce] deja pasar esta vez.
- Permitir siempre deja pasar cada uso de esa herramienta, hasta que cerrás la pestaña.
- :ui[chat.deny] lo rechaza, y a la sesión se le avisa.

Un chat de Cursor en solo lectura analiza y responde, y nunca edita. Uno de confianza edita y corre
comandos sin preguntar: usalo solo en una carpeta que puedas restaurar.

## Abrí una sesión en Ghostty

Cuando [Ghostty](https://ghostty.org) está instalado, el mismo menú tiene :ui[row.ghostty], que
retoma la sesión en una ventana de Ghostty.

## Mirá los servidores MCP que usa Claude Code

:ui[header.settings] › :ui[settings.section.mcp] lista los servidores MCP que tiene configurados
Claude Code. Solo los lee; cambialos en Claude Code.
