---
title: Editá y previsualizá archivos
description: Abrí archivos en pestañas al lado de tus sesiones, previsualizá Markdown y guardá los archivos compartidos de cada proyecto en una carpeta.
sidebar:
  order: 4
---

## Abrí un archivo en una pestaña

- Elegí :ui[menu.openFile] en el menú :ui[header.new] del encabezado, o apretá `Ctrl+Shift+O`, y
  escribí la ruta del archivo o buscalo.
- `Ctrl+clic` en una ruta que una sesión imprimió en su terminal. El texto y el Markdown se abren
  en una pestaña; las carpetas, imágenes y PDF se abren con la aplicación del sistema.
  `Ctrl+Shift+clic` siempre abre la aplicación del sistema.
- Desde una terminal, con Menkar abierto:

  ```sh
  menkar open notes.md src/app.ts
  ```

Una pestaña de archivo colorea el código. Editalo y apretá `Ctrl+S`, o hacé clic en
:ui[files.save]. Si el archivo cambia en el disco mientras tenés cambios sin guardar, elegí
:ui[files.reload] o :ui[files.keepMine]. Los archivos propios de Claude Code, en `~/.claude`, se
abren en solo lectura.

## Previsualizá Markdown

En la pestaña de un archivo Markdown, hacé clic en :ui[files.preview] o apretá `Ctrl+Shift+V`. La
vista previa se abre en una pestaña propia y sigue tus cambios.

![](shot:markdown-preview)

Para hacer preguntas sobre un archivo Markdown, hacé clic en :ui[files.askAgent]: se abre al lado
una sesión nueva de Claude Code, a la que ya se le pidió que lea ese archivo.

## Guardá los archivos compartidos de un proyecto en una carpeta

Cada proyecto tiene una carpeta de archivos, `~/Menkar/<proyecto>/files`, que aparece en Archivos
al pie de la barra lateral, los más nuevos primero. Usala para lo que llega por mail o por chat, y
para lo que una sesión prepara para que compartas.

- Hacé clic en :ui[files.add] y elegí archivos: el selector se abre en tu carpeta de Descargas, y
  los archivos se mueven a la carpeta del proyecto. Un aviso ofrece :ui[files.undo] por unos
  segundos.
- Hacé doble clic en un archivo para abrirlo; clic derecho para :ui[files.openInMenkar],
  :ui[files.openWithSystem] o :ui[files.moveToTrash].
- Arrastrá un archivo de la lista a otra aplicación, como una ventana de mail o de chat.

Cada sesión que Menkar inicia en el proyecto encuentra la ruta de la carpeta en `$MENKAR_FILES`, y
una sesión de Claude Code puede leerla y escribirla sin preguntar. Pedile a una sesión que guarde
ahí lo que vas a compartir.

Los archivos que no cambian en 30 días van a la papelera del sistema. Cambiá los días, o poné 0
para conservarlos, en :ui[header.settings] › :ui[settings.section.files].
