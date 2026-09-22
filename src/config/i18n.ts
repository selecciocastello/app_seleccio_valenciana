export type Language = 'va' | 'es';

export interface Translations {
  appName: string;
  appTagline: string;
  loginTitle: string;
  loginSubtitle: string;
  email: string;
  password: string;
  enter: string;
  logout: string;
  dashboard: string;
  players: string;
  teams: string;
  matches: string;
  callups: string;
  calendar: string;
  agenda: string;
  map: string;
  training: string;
  reports: string;
  admin: string;
  users: string;
  scraping: string;
  logs: string;
  totalPlayers: string;
  observedPlayers: string;
  selectedPlayers: string;
  nextCallup: string;
  nextTraining: string;
  nextEvents: string;
  candidate: string;
  preselected: string;
  selected: string;
  injured: string;
  searchPlaceholder: string;
  addPlayer: string;
  createCallup: string;
  createTraining: string;
  createReport: string;
}

export const translations: Record<Language, Translations> = {
  va: {
    appName: 'Selecció Valenciana Castelló Futbol',
    appTagline: 'Plataforma Tècnica i de Gestió de Jugadors',
    loginTitle: 'Accés Seleccionadors',
    loginSubtitle: 'Introdueix les teues credencials per accedir a la plataforma',
    email: 'Correu Electrònic',
    password: 'Contrasenya',
    enter: 'Accedir',
    logout: 'Tancar Sessió',
    dashboard: 'Tauler Principal',
    players: 'Jugadors',
    teams: 'Equips',
    matches: 'Partits',
    callups: 'Convocatòries',
    calendar: 'Calendari',
    agenda: 'Agenda',
    map: 'Mapa de Partits',
    training: 'Entrenaments',
    reports: 'Informes Tècnics',
    admin: 'Administració',
    users: 'Usuaris i Rols',
    scraping: 'Scraping i Font Dades',
    logs: 'Logs i Auditoria',
    totalPlayers: 'Total Jugadors',
    observedPlayers: 'Observats',
    selectedPlayers: 'Seleccionats',
    nextCallup: 'Pròxima Convocatòria',
    nextTraining: 'Pròxim Entrenament',
    nextEvents: 'Pròxims Esdeveniments',
    candidate: 'Candidat',
    preselected: 'Preseleccionat',
    selected: 'Seleccionat',
    injured: 'Lesionat',
    searchPlaceholder: 'Cercar per nom, equip o posició...',
    addPlayer: 'Afegir Jugador',
    createCallup: 'Nova Convocatòria',
    createTraining: 'Nou Entrenament',
    createReport: 'Nou Informe Tècnic'
  },
  es: {
    appName: 'Selecció Valenciana Castelló Futbol',
    appTagline: 'Plataforma Técnica y de Gestión de Jugadores',
    loginTitle: 'Acceso Seleccionadores',
    loginSubtitle: 'Introduce tus credenciales para acceder a la plataforma',
    email: 'Correo Electrónico',
    password: 'Contraseña',
    enter: 'Acceder',
    logout: 'Cerrar Sesión',
    dashboard: 'Panel Principal',
    players: 'Jugadores',
    teams: 'Equipos',
    matches: 'Partidos',
    callups: 'Convocatorias',
    calendar: 'Calendario',
    agenda: 'Agenda',
    map: 'Mapa de Partidos',
    training: 'Entrenamientos',
    reports: 'Informes Técnicos',
    admin: 'Administración',
    users: 'Usuarios y Roles',
    scraping: 'Scraping y Fuente Datos',
    logs: 'Logs y Auditoría',
    totalPlayers: 'Total Jugadores',
    observedPlayers: 'Observados',
    selectedPlayers: 'Seleccionados',
    nextCallup: 'Próxima Convocatoria',
    nextTraining: 'Próximo Entrenamiento',
    nextEvents: 'Próximos Eventos',
    candidate: 'Candidato',
    preselected: 'Preseleccionado',
    selected: 'Seleccionado',
    injured: 'Lesionado',
    searchPlaceholder: 'Buscar por nombre, equipo o posición...',
    addPlayer: 'Añadir Jugador',
    createCallup: 'Nueva Convocatoria',
    createTraining: 'Nuevo Entrenamiento',
    createReport: 'Nuevo Informe Técnico'
  }
};
