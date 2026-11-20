---
title: Activá la barra de estado y los transcripts más largos
description: Agregá la barra de estado de Menkar a cada sesión de Claude Code, y conservá los transcripts de Claude Code por años en lugar de un mes.
sidebar:
  order: 2
---

Las sesiones que inicia Menkar reciben lo que necesitan de Menkar sin ningún cambio en tu
configuración de Claude Code. Dos agregados llegan más lejos, y cada uno está apagado hasta que lo
activás. Menkar agrega cada uno por separado a `~/.claude/settings.json`, guarda una copia del
archivo antes de cada cambio y deja el resto del archivo como lo tenías. Apagar uno lo vuelve a
sacar.

## Mostrá la barra de estado en cada sesión de Claude Code

Abrí :ui[header.settings] › :ui[settings.section.statusline] y activá
:ui[integrations.statusline].

![](shot:settings-integrations)

Así, las sesiones de Claude Code que corrés fuera de Menkar también informan su contexto y su uso.
Tu propia barra de estado, si tenés una, se sigue mostrando. Si después cambiás la barra de estado
en ese archivo a mano, Menkar deja tu cambio en su lugar cuando la apagás.

## Conservá los transcripts por años

Claude Code borra el transcript de una sesión 30 días después de su último cambio, salvo que su
configuración diga otra cosa. Después de eso la sesión ya no se puede retomar, leer ni exportar.

Abrí :ui[header.settings] › :ui[settings.section.retention]. La sección dice cuánto conserva hoy
Claude Code los transcripts; activá :ui[integrations.retention] para conservarlos 10 años. Si vos
pusiste un tiempo más largo, se mantiene. Apagarlo devuelve lo que había.

El historial de uso de Menkar guarda el tiempo, los tokens y el costo de cada turno de todos modos.
