---
title: Ordená las sesiones en pestañas y paneles
description: Poné dos sesiones lado a lado, abrí una shell al lado de un agente y movete entre pestañas sin el mouse.
sidebar:
  order: 1
---

Cada sesión corre en una pestaña de la fila de arriba. La fila muestra solo las pestañas del
proyecto que muestra la ventana. Una pestaña tiene uno o dos paneles.

## Poné dos sesiones lado a lado

Elegí :ui[row.openBeside] en el menú de una sesión de la barra lateral. Se abre en un segundo panel
de la pestaña que estás mirando.

![](shot:split-panes)

Cada pestaña muestra el punto de estado y el anillo de contexto de sus sesiones. Para pasar la
división de lado a lado a una arriba de la otra, hacé clic derecho en la pestaña y elegí
:ui[tab.menuSwap].

## Abrí una shell al lado de un agente

- Para dividir una pestaña con una shell en la carpeta de la sesión, apretá `Ctrl+B` y después `v`
  (a la derecha) o `-` (abajo). Cerrá el panel con `Ctrl+B` y después `x`.
- Para un comando rápido, como git en la carpeta de la sesión, apretá ``Ctrl+` `` o elegí
  :ui[menu.drawer] en el menú :ui[header.new] del encabezado: se abre una shell debajo de los
  paneles de la pestaña. La misma tecla la esconde y la deja corriendo; escribí `exit` para
  terminarla.

## Movete sin el mouse

`Ctrl+B` funciona como en tmux: apretalo, soltalo y después apretá la tecla del comando. `Ctrl+B`
y después `?` lista todos los comandos.

| Para | Apretá |
|---|---|
| Ir al panel de un costado | `Ctrl+B` y después `h`, `j`, `k` o `l` |
| Agrandar el panel a toda la pestaña, y volver | `Ctrl+B` y después `z` |
| Ir a la pestaña siguiente o a la anterior | `Ctrl+Tab`, `Ctrl+Shift+Tab` |
| Ir a la pestaña 1 a 9 | `Ctrl+B` y después el número |
| Saltar a una sesión del proyecto | `Ctrl+Shift+K` |
| Saltar a cualquier pestaña de cualquier ventana, por nombre o estado | `Ctrl+B` y después `g` |

Todas las teclas están en [Atajos de teclado](/menkar/es/reference/shortcuts/).

## Renombrá, reordená y cerrá pestañas

- Arrastrá una pestaña para moverla en la fila.
- Hacé clic derecho en una pestaña para :ui[tab.menuRename], :ui[tab.menuCloseOthers] y
  :ui[tab.menuCloseAll].
- Cerrar una pestaña detiene sus sesiones; sus conversaciones quedan en el agente. Cerrar una
  ventana pregunta antes cuando una de sus sesiones todavía está corriendo.
