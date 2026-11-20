---
title: Agrupá el trabajo en proyectos
description: Juntá bajo un nombre las sesiones de cada trabajo, agrupalas y sacá las que ya no necesitás.
sidebar:
  order: 2
---

Un proyecto es una lista de sesiones bajo un nombre, de cualquier carpeta. Cada ventana muestra un
proyecto, y su fila de pestañas muestra solo las pestañas de ese proyecto.

## Creá proyectos y cambiá entre ellos

Hacé clic en el nombre del proyecto, arriba de la barra lateral.

![](shot:project-dropdown)

- Para crear uno, escribí su nombre en :ui[projects.newName] y hacé clic en :ui[projects.create].
- Para cambiar, hacé clic en otro proyecto. Sus pestañas vuelven como las dejaste.
- Para renombrar o borrar uno, usá el lápiz y el tacho de su fila.

`Ctrl+Shift+E` cambia entre los proyectos que estás usando, el más reciente primero, como `Alt+Tab`
cambia de ventana.

Borrar un proyecto saca sus sesiones de la lista y detiene las que corren; sus conversaciones
quedan en el agente, y podés agregarlas a otro proyecto.

## Agrupá sesiones dentro de un proyecto

Elegí :ui[row.group] en el menú de una sesión, y después un grupo, :ui[row.newGroup] o
:ui[row.noGroup]. Cada grupo tiene su color; hacé clic en su encabezado para plegarlo. Arrastrá una
fila para reordenarla dentro de su grupo.

## Mové una sesión entre proyectos

Una sesión pertenece a un proyecto como máximo. Abrí :ui[sidebar.addSession] en el proyecto donde
la querés, buscá la sesión en :ui[add.existing] y hacé clic en su botón para moverla desde el otro
proyecto.

## Sacá sesiones

| Para | En el menú de la sesión | Qué pasa con la conversación |
|---|---|---|
| Dejarla en el proyecto, fuera de la lista | :ui[row.hideInProject] (cerrá su pestaña antes) | Queda; el contador de ocultas de la lista la vuelve a mostrar |
| Sacarla del proyecto | :ui[row.remove] | Queda en el agente |
| Mover su transcript a la papelera del sistema | :ui[row.trash], en :ui[add.existing] | Se puede recuperar de la papelera |
| Borrar su transcript | :ui[row.delete], en :ui[add.existing] | Se pierde para siempre |

Borrar un transcript no se puede deshacer, y el agente pierde la sesión con él.

## Leé o exportá una sesión

El menú de una sesión tiene también :ui[row.details] (sus mensajes, modelos, herramientas y
tokens) y :ui[row.export], que escribe la conversación en un archivo Markdown que elegís.
