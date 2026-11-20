---
title: Qué guarda Menkar, y qué nunca manda
description: Qué guarda Menkar en tu computadora, qué lee de los archivos de tus agentes y qué conexiones son de los agentes.
sidebar:
  order: 2
---

## Qué nunca manda Menkar

Menkar no hace ninguna conexión de red propia: ni telemetría, ni búsqueda de actualizaciones, ni
informes de errores, ni fuentes o scripts remotos en sus ventanas. No consulta nada en línea;
actualizalo instalando un paquete más nuevo.

Un enlace se abre en tu navegador solo cuando hacés clic en él: un enlace que imprimió una sesión,
o los dos enlaces de :ui[header.settings] › :ui[settings.section.about].

## Qué mandan los agentes

Menkar corre el comando propio de cada agente, y ese agente se conecta a su servicio como en
cualquier terminal, con tu cuenta: Claude Code a Anthropic, el agente de Cursor a Cursor. Lo que
manda una sesión es asunto del agente y sigue su configuración.

Dos cosas que inicia Menkar pasan por Claude Code, cada una solo cuando la activás:

- El [Control remoto](/menkar/es/sessions/remote-control/) conecta una sesión con la app de Claude
  y con claude.ai.
- [Dividir el uso por etapa](/menkar/es/usage/window/#dividí-cada-proyecto-por-etapa) manda cada
  prompt que escribís, con tu prompt anterior y los archivos y comandos que usó el agente, a Claude
  Haiku con tu cuenta.

## Qué lee y escribe Menkar de los archivos de tus agentes

Menkar lee las sesiones de los agentes para listarlas, nombrarlas y contar su uso, y nunca las
reescribe. Escribe en `~/.claude` solo cuando se lo pedís:

- al mover un transcript a la papelera, o al borrarlo, cada vez después de que lo confirmás;
- la [barra de estado y la retención de transcripts](/menkar/es/settings/integrations/), cada una
  cuando la activás, guardando antes una copia del archivo.

Las pestañas de archivo de Menkar abren los archivos propios de Claude Code en solo lectura.

## Qué guarda Menkar en tu computadora

| Carpeta | Qué tiene |
|---|---|
| `~/.config/menkar/` | La configuración, los proyectos, las ventanas y pestañas, los pendientes y las tareas del modo de orquestación |
| `~/.local/share/menkar/` | El historial de uso, y las copias de `~/.claude/settings.json` hechas antes de cada cambio |
| `~/.cache/menkar/` | El log, y los archivos de trabajo de las sesiones que corre Menkar |
| `~/Menkar/<proyecto>/` | La carpeta de archivos de cada proyecto, y una carpeta privada donde sus sesiones pueden guardar notas |

Cuando tu sistema define `XDG_CONFIG_HOME`, `XDG_DATA_HOME` o `XDG_CACHE_HOME`, las tres primeras
carpetas quedan dentro de esas.

El historial de uso guarda, por cada turno, cuándo corrió, cuánto tardó, sus tokens y su costo, y
los nombres de su sesión y su proyecto. No guarda texto de prompts ni de respuestas. Lo que
registra de tu propia actividad, para [tu tiempo](/menkar/es/usage/window/#mirá-tu-propio-tiempo),
son momentos sin ningún texto.

Quitar el paquete deja estas carpetas. Borralas para quitar lo que guardó Menkar.
