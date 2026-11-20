---
title: Elegí un orquestador
description: Activá el modo de orquestación en un proyecto, elegí la sesión con la que vas a hablar y pasale las demás.
sidebar:
  order: 2
---

## Activá el modo de orquestación

1. Abrí el proyecto en la ventana.
2. Hacé clic en :ui[orch.switch] en el encabezado. El ícono de equipo de la lista de proyectos hace
   lo mismo para cualquier proyecto.

Mientras el proyecto no tenga orquestador, una tarjeta te pregunta quién orquesta.

![](shot:first-time-card)

## Completá la tarjeta

1. En :ui[orch.cardWho], elegí una de las sesiones del proyecto, o :ui[orch.cardNew] con su nombre
   y la carpeta donde iniciarla.
2. En :ui[orch.cardManaged], dejá marcadas las sesiones a las que el orquestador les va a dar
   trabajo. Desmarcá las que todavía están en medio de algo con vos, y cualquier sesión que quieras
   dejar fuera del equipo: la pestaña de una sesión marcada pasa a ser de solo lectura.
3. En :ui[orch.workersCap], escribí cuántos workers pueden correr a la vez, o dejalo vacío para
   cualquier cantidad.
4. Hacé clic en :ui[orch.cardStart].

:ui[orch.cardNotNow] deja el modo desactivado. :ui[orch.cardGuide] abre en una pestaña la guía que
lee el orquestador; cerrá la pestaña para volver a la tarjeta como la dejaste.
:ui[orch.cardCopy] copia un prompt que le indica esa guía a otra sesión.

Un orquestador nuevo lee primero la guía, y después te acompaña con el resto: qué sesiones darle,
qué rol tiene cada una y cómo funciona el proyecto.

## Contale al orquestador cómo funciona el proyecto

Escribilo en las instrucciones propias del proyecto (su `CLAUDE.md`), o pedile al orquestador que
lo escriba ahí:

- si las sesiones comparten un mismo árbol de trabajo, y quién hace commit y push;
- qué verificaciones corre un worker antes de reportar;
- dónde guarda el proyecto sus decisiones;
- los expertos y los consultores, y el área de cada uno;
- el modelo con el que corren los workers.

Con unas pocas líneas alcanza. El orquestador nunca adivina lo que falta: te pregunta.

## Cambiá el orquestador

Hacé clic derecho en otra sesión de la barra lateral, o en su `⋮`, y elegí :ui[orch.orchestrator].
Un proyecto tiene un solo orquestador, así que la marca deja la sesión anterior.

## Cambiá los ajustes más tarde

Con el modo activado, abrí la lista de proyectos y hacé clic en el engranaje junto al ícono de
equipo del proyecto. Ahí cambiás :ui[orch.workersCap] y las :ui[orch.folders] donde el orquestador
puede iniciar workers, con :ui[orch.folderAdd] para un repositorio en el que todavía no trabaja
ninguna sesión.

## Desactivá el modo

Hacé clic de nuevo en :ui[orch.switch]. El orquestador, los roles, las tareas y los pendientes
quedan guardados para la próxima vez; la barra lateral muestra la lista de siempre, todas las
pestañas aceptan teclas y el Tablero se cierra.
