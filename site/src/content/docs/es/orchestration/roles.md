---
title: Dale a una sesión un rol y skills
description: Poné una etiqueta a lo que hace una sesión, elegí las skills que carga y decidí quién trabaja debajo del orquestador.
sidebar:
  order: 7
---

## Conocé los cuatro tipos de sesión

Qué es una sesión sale de dos cosas que vos fijás: si trabaja debajo del orquestador, y si tiene un
rol.

| Sesión | Debajo del orquestador | Rol | Usala para |
|---|---|---|---|
| El orquestador | — | Opcional | Hablar con vos, repartir el trabajo y revisarlo |
| Un worker | Sí | No | Una tarea; se va cuando la tarea se cierra |
| Un experto | Sí | Sí | Una parte del sistema que siempre implementa, como las versiones |
| Un consultor | No | Sí | Responderle a cualquiera sobre un área que conoce, a menudo otro repositorio |

Los expertos y los consultores tienen pestañas comunes, y nunca se aparcan ni cuentan entre los
workers. La pestaña de un consultor siempre acepta teclas.

## Dale un rol a una sesión

1. Hacé clic derecho en la sesión en la barra lateral, o en su `⋮`, y elegí
   :ui[orch.configureRole].
2. Escribí un :ui[orch.roleLabel] corto, como «Revisor de la API». Vacío, lo quita.
3. Marcá las :ui[orch.roleSkills] que debe cargar (abajo).
4. Hacé clic en :ui[dialog.save].

![](shot:configure-role)

## Elegí las skills

La lista tiene las skills que la sesión puede cargar: las de su propio repositorio
(`.claude/skills/`) y las tuyas (`~/.claude/skills/`). Las skills propias de Menkar no están: salen
del lugar de la sesión en el equipo.

- Marcá una skill para agregarla. Queda en :ui[orch.roleReadOnly]: la sesión la carga y nunca la
  edita.
- Pasala a :ui[orch.roleMaintainer] para la única sesión que la mantiene al día. Una skill tiene un
  solo responsable, así que para pasarla a otra sesión, primero sacásela a la anterior.
- Una skill guardada que la sesión ya no encuentra aparece primero, tachada, hasta que la quites.

Solo vos fijás las skills de una sesión, y una sesión que está corriendo se entera del cambio en el
momento.

## Pasale una sesión al orquestador

Hacé clic derecho en la sesión y elegí :ui[orch.handTo]. No se reinicia nada: el orquestador
empieza a darle trabajo y su pestaña pasa a ser de solo lectura. :ui[orch.takeBack] lo deshace.
También podés pedirle al orquestador que tome una sesión.

## Quedate con una sesión

Hacé clic derecho en una sesión que está debajo del orquestador y elegí :ui[orch.withYou], o hacé
clic en :ui[orch.takeControl] en su pestaña. El orquestador no le da trabajo hasta que quites la
marca; Menkar nunca la pone ni la quita por su cuenta.
