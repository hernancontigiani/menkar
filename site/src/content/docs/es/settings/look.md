---
title: Cambiá el aspecto y el idioma
description: Elegí claro u oscuro, un tema, la fuente y el tamaño de la interfaz, el idioma, y cuándo te avisa Menkar.
sidebar:
  order: 1
---

Hacé clic en :ui[header.settings] en el encabezado, o apretá `Ctrl+,`. La configuración se abre en
una ventana propia, con sus secciones a la izquierda. Un cambio llega a todas las ventanas a la
vez.

## Elegí colores, fuente y tamaño

Abrí :ui[settings.section.appearance].

![](shot:settings-look)

| Ajuste | Opciones |
|---|---|
| :ui[prefs.colorScheme] | :ui[prefs.schemeSystem], :ui[prefs.schemeLight] o :ui[prefs.schemeDark] |
| :ui[prefs.interfaceStyle] | :ui[prefs.styleTui] o :ui[prefs.styleClassic] |
| :ui[prefs.colorTheme] | VS Code, Catppuccin Mocha y Latte, Solarized Dark y Light |
| :ui[prefs.terminalColors] | :ui[prefs.terminalUbuntu], :ui[prefs.terminalNeutral] o :ui[prefs.terminalTheme] |
| :ui[prefs.interfaceSize] | De 90 % a 150 %, para el texto y los controles de Menkar; las terminales mantienen el tamaño de su fuente |
| :ui[prefs.font] | Cualquier fuente monoespaciada instalada, y su tamaño, para las terminales y el editor de archivos |

Cuántas líneas guarda una terminal para volver atrás está en :ui[settings.section.terminal].

## Cambiá el idioma

Abrí :ui[settings.section.language], elegí inglés, español o :ui[prefs.systemDefault], y hacé clic
en :ui[prefs.restartNow]. Menkar pregunta primero por los cambios sin guardar en archivos; después
detiene las sesiones que corren sin preguntar, se reinicia y las retoma en sus pestañas.

## Elegí cuándo te avisa Menkar

En :ui[settings.section.notifications], :ui[prefs.notifyIdle] y :ui[prefs.notifySound] actúan
cuando una sesión que no estás mirando termina o necesita tu respuesta. Hacé clic en un aviso para
ir a esa sesión.

## Definí cuándo avisa el anillo de contexto

Cada sesión de Claude Code, Codex y OpenCode muestra un anillo con cuánto de su contexto está lleno: verde, amarillo
desde 60 %, rojo desde 90 %. Cambiá los dos umbrales en :ui[settings.section.context]. Pasá el
puntero sobre un anillo para ver la cifra exacta.

## Arrancá sin las últimas pestañas

Menkar reabre cada ventana con sus pestañas y retoma sus sesiones. Para arrancar vacío, apagá
:ui[prefs.reopenTabs] en :ui[settings.section.sessions].
