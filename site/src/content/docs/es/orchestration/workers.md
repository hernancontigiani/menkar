---
title: Usá un worker por tarea
description: Dejá que el orquestador inicie un worker por tarea, mirá uno cuando lo necesites y hablale vos.
sidebar:
  order: 6
---

## Dejá que el orquestador inicie los workers

Para cada tarea, el orquestador inicia una sesión nueva, un worker, con el nombre del proyecto y de
la tarea (`app-atlas-t2` para la tarea 2 de App Atlas). Mientras el modo está activado y el
proyecto tiene orquestador, solo el orquestador inicia sesiones; pedíselo a él y no a otra sesión.

Los workers corren en segundo plano: no tienen pestaña en la fila, y sus filas en la barra lateral
dicen qué hace cada uno.

![](shot:background-workers)

## Mirá un worker

Hacé clic en la fila de un worker, en su tarea o en su tarjeta del Tablero. Se abre en la pestaña
de vistazo, la última de la fila, con su nombre en cursiva. Al hacer clic en otro worker, lo
reemplaza ahí.

![](shot:peek-tab)

Para dejarlo como una pestaña común, hacé clic en el pin de la pestaña de vistazo, doble clic en la
pestaña o en la fila, o elegí :ui[row.open] en el menú de la fila. Su nombre en la barra lateral
pasa a negrita, con un pin.

Cerrar la pestaña de un worker lo devuelve a segundo plano, todavía corriendo. Un worker se detiene
cuando elegís :ui[row.stop], cuando el orquestador lo aparca o cierra su tarea, cuando lo quitás,
cerrás su ventana o salís de Menkar.

## Respondé el permiso que pide un worker

Un worker en segundo plano que espera un permiso muestra una píldora roja con su nombre a la
derecha de la fila de pestañas. Hacé clic en ella para abrir el worker en la pestaña de vistazo, y
respondé ahí: su pestaña acepta teclas mientras espera.

## Hablale vos a un worker

La pestaña de un worker es de solo lectura, bajo una franja amarilla: :ui[orch.bannerReports]

1. Hacé clic en :ui[orch.takeControl]. La franja pasa a azul, la pestaña acepta teclas y el
   orquestador no le da trabajo al worker mientras está con vos.
2. Hablá con el worker. Antes de devolverlo, pedile que le cuente al orquestador qué salió.
3. Hacé clic en :ui[orch.handBack].

El orquestador se entera las dos veces.

## Dejá que un worker espere aparcado

Cuando una tarea va a esperar mucho, por ejemplo la revisión de un pull request, el orquestador
aparca su worker: Menkar lo detiene cuando termina su turno y guarda su conversación. Los workers
aparcados quedan plegados en una fila propia debajo del orquestador, cada uno con lo que espera.
Cuando termina la espera, contale al orquestador qué volvió; retoma el mismo worker, con toda su
conversación.

## Limitá los workers a la vez

:ui[orch.workersCap] limita los workers que corren al mismo tiempo; en el límite, el orquestador
deja la tarea siguiente en cola hasta que un worker termine. Los expertos, los consultores y los
workers aparcados no cuentan, y un worker en segundo plano sí. Fijá el límite en la tarjeta cuando
[elegís un orquestador](/menkar/es/orchestration/set-up/), en los ajustes de orquestación del
proyecto, o pidiéndoselo al orquestador.

## Trabajá en varios repositorios

El orquestador puede iniciar un worker en cualquiera de las carpetas del proyecto: cada carpeta en
la que trabajan sus sesiones, y las que agregás en :ui[orch.folders], en los ajustes de
orquestación del proyecto. Un cambio que abarca dos repositorios se vuelve una tarea por
repositorio.

## Limpiá después de una tarea

Cuando el orquestador cierra una tarea, su worker se detiene y su fila deja la barra lateral.
Después de revisarla, el orquestador mueve los archivos del worker, como capturas y registros, de
la carpeta de archivos del proyecto a la papelera del sistema, de donde podés recuperarlos.
