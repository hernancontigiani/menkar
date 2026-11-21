---
title: Seguí el trabajo
description: Leé la barra lateral en el modo de orquestación, desde tus pendientes hasta lo hecho hoy.
sidebar:
  order: 3
---

## Leé los contadores

Las tres casillas de arriba cuentan tus pendientes, las tareas en curso y las tareas que esperan
algo. Ellas y :ui[board.topics] quedan a la vista aunque bajes en la lista.

## Mirá tus pendientes

:ui[board.topics] lista los pendientes que solo vos podés responder, en el orden en que conviene
tomarlos: primero el que se está discutiendo, con un punto verde, después los de la tarea con la ★,
después los que bloquean, con una marca roja, y después el resto por número. Hacé clic en un
pendiente para leer su contexto, quién lo planteó y su estado.

![](shot:work-view-awaiting)

La lista es de solo lectura: [respondé un pendiente](/menkar/es/orchestration/topics-and-tasks/) en
la pestaña del orquestador.

## Seguí cada tarea

Seguí las tareas en [el Tablero](/menkar/es/orchestration/board/), abierto encima de las pestañas
mientras el modo está activado.

## Encontrá una sesión del equipo

Debajo de los pendientes está el equipo:

- el orquestador, con las sesiones a las que les da trabajo debajo. Su grupo empieza plegado;
  plegado, su fila dice cuántas tiene debajo y muestra el estado más urgente entre ellas, en rojo
  cuando una espera un permiso;
- :ui[orch.consultants], las sesiones con un rol fuera del equipo;
- :ui[orch.others], las demás sesiones del proyecto.

Cada fila muestra, debajo del nombre, la tarea actual de la sesión y su paso. Hacé clic en el
triángulo junto a un grupo para plegarlo o desplegarlo; Menkar guarda cada pliegue por proyecto.

## Repasá el día

Al pie de la lista, una sección plegada tiene los pendientes cerrados y las tareas hechas desde la
medianoche. Hacé clic en ella para desplegarla.

## Sabé cuándo mirar

Con el modo activado, las sesiones que están debajo del orquestador no hacen sonido, ni aviso, ni
notificación de escritorio: el orquestador te cuenta lo que importa. El orquestador mismo, las
sesiones que están con vos y las que están fuera del equipo avisan como siempre. Un pendiente nuevo
también te avisa, y uno que pasa a bloquear; mientras discutís uno, los nuevos llegan sin sonido.

Para silenciar cualquier sesión, hacé clic derecho en su fila y elegí :ui[row.mute].

Cuando un worker espera un permiso y su pestaña no está a la vista, Menkar agrega un pendiente
bloqueante por él. Hacé clic en su aviso, o en :ui[toast.show], para abrir la pestaña de ese worker
y responder ahí; el pendiente se cierra solo una vez que respondiste.
