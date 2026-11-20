---
title: Dale forma a un equipo
description: Decidí cuánto sabe el orquestador, y qué expertos y consultores trabajan a su lado.
sidebar:
  order: 9
---

Lo que cambia de un proyecto a otro es cuánto sabe el orquestador mismo, y por lo tanto cuánto
llevan los [expertos y consultores](/menkar/es/orchestration/roles/) a su lado.

## Empezá con el orquestador solo

En un proyecto chico, hablá solo con el orquestador. Diseña el trabajo, le da cada tarea a un
worker y revisa lo que vuelve.

## Sumá expertos para las partes que se repiten

Cuando una parte del sistema vuelve una y otra vez, como las versiones, dale a una sesión un rol y
su propia skill, y pasásela al orquestador. El orquestador le da el trabajo de esa parte y se
entera cuando termina, así no tenés que seguir a los dos. Para todo lo demás siguen yendo y
viniendo workers.

## Sumá consultores para las áreas que el orquestador no conoce

Cuando el trabajo abarca un área que el orquestador no conoce, a menudo otro repositorio, dale a
una sesión un rol y dejala fuera del equipo: un consultor. Para el trabajo en esa área, el
orquestador le pide al consultor los puntos clave, inicia un worker y le dice que le haga sus
preguntas al consultor. El consultor puede revisar el resultado, y queda libre para pensar con vos.

Sin un consultor para un área, el orquestador te pregunta a vos. Cuando el mismo tipo de pregunta
se repite, creá un consultor para ella.

## Usá un modelo más chico para los workers

Cuando un consultor responde las preguntas de los workers y revisa su trabajo, los workers pueden
correr con un modelo más chico. Escribí cuál en las instrucciones del proyecto; el orquestador
nunca elige uno por su cuenta.

## Mantené al día a expertos y consultores

Hacé que la skill de cada uno tenga formas de trabajar y apunte a los documentos del proyecto, sin
copiar sus datos; un worker que cambia una función actualiza su documento en el mismo cambio.
Cuando lo que cambió altera cómo trabaja un experto o un consultor, pedile que cargue
`menkar:distill` y actualice su skill.
