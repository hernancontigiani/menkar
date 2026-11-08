import type { en } from './en'

// A key missing here shows its English text.
export const es: Partial<Record<keyof typeof en, string>> = {
  'window.title': 'Menkar',
  'projects.nameEmpty': 'Un proyecto necesita un nombre.',
  'projects.nameTaken': 'Ya hay un proyecto con ese nombre.',
  'projects.lastProject': 'El último proyecto no se puede borrar.',
  'projects.fileUnreadable':
    'No se pudo leer el archivo de proyectos; se guardó como {name} y se empezó uno nuevo',
  'groups.nameEmpty': 'Un grupo necesita un nombre.',
  'groups.nameTaken': 'Ya hay un grupo con ese nombre.',
  'layout.twoPanesMax': 'Una pestaña tiene como máximo dos paneles',
  'layout.otherProject': 'Pertenece a otro proyecto; agregala acá primero',
  'layout.alreadyBeside': 'Ya está al lado de otra sesión',
  'layout.sharesTab': 'Comparte una pestaña con otra sesión allá',
  'import.projectsUnreadable':
    'No se pudieron leer los proyectos de Agent Tablet, así que no se importaron.',
  'import.stateUnreadable':
    'No se pudo leer la configuración de Agent Tablet, así que no se importaron nombres, sesiones ocultas ni preferencias.',
  'usage.noProject': '(sin proyecto)',
  'usage.unclassified': 'Sin clasificar',
  'usage.tooNew': 'El historial de uso es de una versión más nueva de Menkar',
  'usage.cli.usage': 'uso:',
  'usage.cli.error': 'menkar usage: error: {message}',
  'usage.cli.unknownArgument': 'argumento no reconocido: {argument}',
  'usage.cli.needsValue': '{flag} necesita un valor',
  'usage.cli.notTogether': '{first} y {second} no pueden usarse juntos',
  'usage.cli.fromAndTo': '--from y --to van juntos',
  'usage.cli.badChoice': "{flag}: '{value}' no es uno de {choices}",
  'usage.cli.badMonth': "--month: '{value}' no es un mes (AAAA-MM)",
  'usage.cli.badDay': "'{value}' no es una fecha (AAAA-MM-DD)",
  'usage.cli.passFailed':
    'No se pudieron leer los últimos transcripts en el historial de uso; se muestra como estaba.',
  'usage.cli.cannotOpen': 'No se pudo abrir el historial de uso.',
  'usage.cli.exec': 'ejec.',
  'usage.cli.blocked': 'bloqueado',
  'usage.cli.tokens': 'tokens',
  'usage.cli.cost': 'costo',
  'usage.cli.subscription': 'suscripción: 5 horas {five}%, 7 días {seven}%',
  'usage.cli.legend': '~ = estimación a precio de lista; + = un modelo sin precio',
}
