import type { en } from './en'

// Complete, not Partial: a string missing in Spanish is a compile error. Voseo and the app
// catalog's terms ("pendiente", "tarea", "orquestador"), as the Spanish UI speaks.
export const es: Record<keyof typeof en, string> = {
  projectTeam: 'App Atlas',
  projectSite: 'Sitio Harbor',
  projectNotes: 'Notas de campo',
  filesFolder: 'notas-de-campo',

  sessionLead: 'planificacion',
  sessionReviewer: 'analisis-api',
  sessionDocs: 'docs-redactor',
  sessionSiteBuild: 'sitio-build',
  sessionNotes: 'notas',
  sessionRelease: 'notas-de-version',
  sessionSpike: 'prueba-busqueda',

  roleReviewer: 'Revisor de la API',
  skillApiStyle: 'api-estilo',
  skillOpenapi: 'lint-openapi',
  skillApiStyleText: 'Cómo nombra este equipo los endpoints, los campos y los errores.',
  skillOpenapiText: 'Revisa el archivo OpenAPI contra la guía de estilo.',
  skillChangelog: 'cambios',
  skillChangelogText: 'Escribe las notas de la versión a partir de los cambios integrados.',

  task1: 'Renombrar el menú de exportación',
  task2: 'Agregar exportación a CSV',
  task3: 'Arreglar el vencimiento del login',
  task4: 'Actualizar los textos de bienvenida',
  task5: 'Escribir las notas de la versión',
  task6: 'Probar una biblioteca de gráficos',

  task2Step1: 'Leer el código de exportación',
  task2Step2: 'Escribir el generador de CSV',
  task2Step3: 'Sumarlo al menú',
  task2Step4: 'Probar con archivos grandes',
  task2Step5: 'Reportar',
  task2Note: 'El generador maneja comillas y saltos de línea; ahora conecto el menú',

  task3Step1: 'Reproducir el vencimiento',
  task3Step2: 'Elegir el nuevo límite',
  task3Step3: 'Cambiarlo y probarlo',
  task3Step4: 'Reportar',
  task3Note: 'Reproducido: la sesión se cierra tras 15 minutos sin uso',

  task4Step1: 'Leer las pantallas actuales',
  task4Step2: 'Reescribir los textos',
  task4Step3: 'Reportar',
  task4Note: 'Listo: tres pantallas reescritas, un tercio más cortas',

  task1Step1: 'Encontrar cada etiqueta',
  task1Step2: 'Renombrarlas',
  task1Step3: 'Reportar',
  task1Note: 'Renombrado en el menú y en la lista de atajos',

  topic1: 'Formato de fecha en el archivo CSV',
  topic1Context: 'Las fechas ISO se ordenan bien; las locales se leen mejor en una planilla.',
  topic2: 'Vencimiento de la sesión: ¿15 o 30 minutos?',
  topic2Context: 'Soporte pide 30; seguridad prefiere 15 por las computadoras compartidas.',
  topic3: 'Nombre del botón de exportar',
  topic3Context: '¿Exportar, Descargar o Guardar como?',
  topic3Decision: 'Exportar',

  promptLead: 'Planificá la versión 2.4 con el equipo',
  screenLead1: 'Hay tres tareas en curso; la tarea 4 está lista para que la revises.',
  screenLead2: 'La tarea 3 sigue cuando elijas el vencimiento de la sesión.',
  promptReviewer: 'Revisá el nuevo endpoint de exportación',
  screenReviewer1: 'El endpoint envía las filas de a poco en vez de armar el archivo en memoria.',
  askReviewer: 'npm run test:api -- export',
  promptWorker2: 'Tarea 2: agregar exportación a CSV',
  screenWorker2a: 'Escribí el generador de CSV con comillas y saltos de línea.',
  screenWorker2b: 'Sumando la opción al menú de exportación.',
  promptWorker3: 'Tarea 3: arreglar el vencimiento del login',
  screenWorker3a: 'Reproducido: la sesión se cierra tras 15 minutos sin uso.',
  screenWorker3b: 'Le pregunté al revisor de la API qué límite permite.',
  promptWorker4: 'Tarea 4: actualizar los textos de bienvenida',
  screenWorker4a: 'Reescribí la bienvenida, el primer proyecto y la invitación.',
  screenWorker4b: 'Listo para revisar.',
  promptDocs: 'Escribí la página de primeros pasos',
  screenDocs1: 'Armé la página con tres pasos y una captura en cada uno.',
  promptSiteBuild: 'Hacé que el sitio se construya el doble de rápido',
  screenSiteBuild1: 'Las imágenes ahora se redimensionan una vez por archivo, no una por página.',
  promptNotes: 'Resumí las entrevistas de esta semana',
  screenNotes1: 'Cinco entrevistas, dos pedidos en común: modo sin conexión y exportar a CSV.',
  promptNew: '¿En qué trabajamos?',

  chatPrompt: 'Contá las entrevistas que piden exportar a CSV',
  chatAnswer: 'Dos de cinco. Reviso también las otras notas.',
  chatAsk: 'grep -il "csv" *.md',

  usagePrompt: 'Seguí',
  usageAnswer: 'Listo.',

  fileInterviews: 'entrevistas.md',
  fileInterviewsText:
    '# Entrevistas, semana 46\n\nCinco personas que usan la app todos los días.\n\n## Qué pidieron\n\n- **Modo sin conexión**: tres de cinco trabajan en el tren.\n- **Exportar a CSV**: dos de cinco copian tablas a mano.\n\n## Lo que sigue\n\n1. Compartirlo con el equipo.\n2. Elegir un pedido para la 2.4.\n',
  filePlan: 'plan-de-version.md',
  filePlanText:
    '# Versión 2.4\n\n- Exportar a CSV\n- Un vencimiento del login más largo\n- Textos de bienvenida nuevos\n',

  'alt:hero-orchestration':
    'Menkar con el equipo de App Atlas: el Tablero con las tareas y sus pasos encima de la terminal del orquestador y, en la barra lateral, lo que está pendiente tuyo y las sesiones.',
  'alt:board-default':
    'El Tablero abierto bajo el encabezado: Pendientes tuyos, En cola, En curso, Esperando, Para revisar y Hecho, una columna cada una, con las tareas como tarjetas.',
  'alt:first-time-card':
    'La tarjeta que activa el modo de orquestación en Sitio Harbor: el orquestador a elegir, su carpeta y cuántos workers a la vez.',
  'alt:work-view-awaiting':
    'Lo alto de la barra lateral: cuántos pendientes tuyos, en curso y esperando hay, y los dos pendientes tuyos.',
  'alt:topic-discussing':
    'Un pendiente tuyo desplegado en la barra lateral: su contexto, quién lo planteó, que se está discutiendo y que bloquea una tarea.',
  'alt:work-view-overview':
    'Toda la barra lateral de un proyecto en el modo de orquestación: los pendientes tuyos, el orquestador, los consultores y lo hecho hoy.',
  'alt:task-to-review':
    'La columna Para revisar del Tablero: una tarea lista para revisar, esperando al humano.',
  'alt:background-workers':
    'El orquestador desplegado en la barra lateral, con sus workers y sus tareas; las pestañas de los workers quedan en segundo plano.',
  'alt:peek-tab': 'Un worker en la pestaña de vistazo, al final de la tira, con su terminal.',
  'alt:configure-role': 'El diálogo que le da a una sesión su rol y las skills que carga.',
  'alt:project-dropdown': 'La lista de proyectos abierta bajo el encabezado.',
  'alt:split-panes': 'Una pestaña dividida en dos paneles, con una sesión en cada uno.',
  'alt:markdown-preview':
    'Un archivo Markdown de los archivos del proyecto, en una pestaña como vista previa.',
  'alt:add-session-existing':
    'El diálogo Agregar sesión con sesiones anteriores para sumar al proyecto.',
  'alt:add-session-new':
    'El diálogo Agregar sesión empezando una sesión nueva, con las carpetas donde empezarla.',
  'alt:chat-permission':
    'Una sesión continuada como chat, pidiendo permiso para ejecutar un comando.',
  'alt:settings-look':
    'Ajustes abierto en Apariencia: el esquema y el tema de colores, los colores de la terminal, el tamaño de la interfaz y la fuente.',
  'alt:settings-integrations':
    'Ajustes abierto en Barra de estado: la barra de estado, que Menkar agrega a los ajustes de Claude Code solo si la activás.',
  'alt:usage-spend':
    'La ventana Uso en Gasto: tiempo, tokens y costo por proyecto y por sesión en los últimos siete días.',
  'alt:usage-your-time':
    'La ventana Uso en Tu tiempo, un día hora por hora: cuándo trabajaste con las sesiones, tu tiempo activo y los mensajes que enviaste.',
  'alt:away-strip':
    'La franja bajo el encabezado mientras estás ausente, con la hora en que te fuiste y Ya volví.',
}
