---
title: Seguí una sesión desde tu teléfono
description: Activá el Control remoto de Claude Code en una sesión, para seguirla y responderle desde la app de Claude o claude.ai.
sidebar:
  order: 6
---

El Control remoto es de Claude Code: conecta una sesión que corre con la app de Claude de tu
teléfono y con claude.ai, con el nombre de la sesión. Menkar lo activa por sesión, y está apagado
hasta que lo activás. Las sesiones de los otros agentes no lo tienen.

## Activá el Control remoto

- Para una sesión nueva, activá :ui[rc.switch] antes de hacer clic en :ui[newSession.start].
- Para una sesión que ya tenés, elegí :ui[rc.item] en su menú de la barra lateral, o en el menú de
  una pestaña que tenga solo esa sesión. Una tilde marca que está activo.
- Si la sesión está corriendo, Menkar pregunta antes. Elegí :ui[rc.restartNow] para conectarla ya:
  la sesión vuelve a arrancar en su pestaña con su conversación, y un mensaje escrito y no enviado
  se pierde. Elegí :ui[rc.later] para conectarla la próxima vez que arranque, o escribí
  `/remote-control` en la sesión. Mientras la sesión trabaja o te espera, solo se ofrece
  :ui[rc.later].

Desde entonces Menkar arranca esa sesión con Control remoto, hasta que elegís :ui[rc.item] de nuevo
para sacar la tilde.

## Mirá qué sesiones están conectadas

Un ícono de teléfono en la fila de una sesión dice que su Control remoto está conectado ahora,
como sea que se haya activado.
