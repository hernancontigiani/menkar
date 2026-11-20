---
title: Usá varias ventanas
description: Abrí una ventana por proyecto, y traé un proyecto de una ventana a otra.
sidebar:
  order: 3
---

Cada ventana muestra un proyecto, y un proyecto está abierto en una sola ventana a la vez.

## Abrí una ventana nueva

Elegí :ui[menu.newWindow] en el menú :ui[header.new] del encabezado, o apretá `Ctrl+Shift+N`. Se
abre en un proyecto que ninguna otra ventana tiene; cuando todos los proyectos están abiertos en
alguna, creá un proyecto nuevo para ella.

## Traé un proyecto a esta ventana

Elegí, en la lista de proyectos, uno que tiene otra ventana. Menkar pregunta qué hacer:

- :ui[projects.bringHere] mueve sus pestañas acá, en su orden; sus sesiones siguen corriendo.
- :ui[projects.goThere] trae esa ventana al frente y no cambia nada.

`Ctrl+Shift+E` e :ui[shortcut.goToAgent] (`Ctrl+B` y después `g`) siempre traen la otra ventana al frente.

## Cerrá una ventana

Cerrar una ventana detiene sus sesiones, y pregunta antes cuando una de ellas todavía está
corriendo. La última ventana que cerrás guarda sus pestañas para el próximo inicio, y si estaba
maximizada.
