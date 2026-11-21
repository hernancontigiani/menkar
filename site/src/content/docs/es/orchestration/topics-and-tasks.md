---
title: Respondé tus pendientes
description: Tomá los pendientes que solo vos podés responder, elegí la tarea que va primero y revisá lo que está hecho.
sidebar:
  order: 4
---

## Tomá un pendiente

1. Hacé doble clic en el pendiente, en :ui[board.topics]. Menkar lo marca como el que se está
   discutiendo, muestra la pestaña del orquestador y le avisa al orquestador.
2. Leé el resumen del orquestador y respondele ahí, en su pestaña.
3. El orquestador cierra el pendiente con tu decisión y toma el siguiente.

![](shot:topic-discussing)

Un pendiente cerrado guarda su decisión: preguntale al orquestador «¿qué decidimos en el pendiente
7?» y te responde desde ahí.

Todo lo que espera de vos es un pendiente: una pregunta, una elección entre opciones, un cambio
para probar a mano. Para plantear uno vos, pedíselo al orquestador; cualquier sesión del proyecto
también puede agregar uno.

## Elegí la tarea que va primero

Hacé clic derecho en una tarea del Tablero y elegí :ui[work.star], o
pedíselo al orquestador. Los pendientes de una tarea con la ★ van primero en :ui[board.topics], y
cuando varias sesiones terminan a la vez, el orquestador escucha primero a las que tienen tareas
con la ★.

## Seguí una tarea por sus estados

| Estado | Qué significa |
|---|---|
| :ui[board.queued] | Creada, y ninguna sesión la empezó, por ejemplo mientras todos los lugares de workers están ocupados. |
| :ui[board.inProgress] | Su sesión la dividió en pasos y está en uno de ellos. |
| :ui[board.waiting] | Espera algo: un pendiente, otra sesión, un build. |
| :ui[board.toReview] | Su sesión dice que terminó; la tiene que revisar el orquestador, vos o un pull request. |
| :ui[board.done] | El orquestador la revisó y la cerró, como hecha o descartada. |

## Revisá una tarea

Una tarea en :ui[board.toReview] dice a quién espera: al orquestador, a vos, o la aprobación o el
merge de un pull request.

![](shot:task-to-review)

Hecha siempre quiere decir revisada: solo el orquestador cierra una tarea, después de leer el
resultado. Cuando la revisión es tuya, como un cambio para probar a mano, te llega como un
pendiente.
