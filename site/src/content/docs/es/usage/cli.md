---
title: Leé el uso desde la terminal
description: Imprimí el informe de uso, exportá cada turno para una planilla o una sesión de IA, y leé tu racha en curso.
sidebar:
  order: 2
---

`menkar usage` lee el mismo historial que la [ventana de uso](/menkar/es/usage/window/), lo
imprime y termina. No abre ninguna ventana ni necesita pantalla.

## Imprimí un informe

```sh
menkar usage                                    # los últimos 7 días
menkar usage --period today                     # today, 7d, 30d o all
menkar usage --month 2026-10                    # un mes calendario
menkar usage --from 2026-11-01 --to 2026-11-03  # los dos días incluidos
menkar usage --period today --by hour           # un informe por hora, día o mes
menkar usage --json                             # JSON en lugar de texto
```

Un costo con `~` es una estimación a precio de lista, no una factura; un `+` indica un modelo sin
precio conocido.

## Exportá cada turno

`menkar usage export` escribe una fila por turno: su sesión y su proyecto, cuándo empezó, su tiempo
de trabajo y de espera, y sus tokens y su costo por modelo. Ninguna fila tiene texto de prompts o
respuestas, ni rutas.

```sh
menkar usage export --month 2026-10                  # líneas JSON, una por turno
menkar usage export --period 30d --format csv        # CSV, para una planilla
menkar usage export --project "App Atlas" --output turnos.jsonl
```

Pasale la exportación a una sesión de Claude Code para que la analice, por ejemplo: *"Corré
`menkar usage export --month 2026-10` y decime el costo por modelo de cada proyecto."*

`--rows activity` exporta en cambio tus propios momentos (mensajes, permisos respondidos, ausente y
de vuelta), y `--rows tasks` cada cambio de estado de una tarea. Ninguna de las dos tiene texto.

## Armá tu propio recordatorio de pausa

Menkar nunca te dice que hagas una pausa. Para un programa tuyo que lo haga, corré:

```sh
menkar usage now --json
```

Imprime un objeto JSON: si estás en una racha de actividad y desde cuándo, si estás ausente, tu
última acción y el tiempo activo de hoy. Corrélo más o menos una vez por minuto.
