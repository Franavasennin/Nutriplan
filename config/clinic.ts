// Base del enlace del Portal del Paciente (/p/TOKEN). Configurable vía
// VITE_PORTAL_BASE_URL (el dominio final de producción, una vez elegido el
// hosting) sin tocar código; en dev/preview cae a window.location.origin.
export const PORTAL_BASE_URL: string =
  (import.meta.env.VITE_PORTAL_BASE_URL as string | undefined) || window.location.origin;

export const CLINIC = {
  name:        'Ester Correa',
  title:       'Especialista Ester Correa',
  role:        'Dietista-Nutricionista',
  initials:    'EC',
  subtitle:    'Especialista Ester Correa - Nutrición Clínica',
  appName:     'NutriPlan Pro',
  // Disclaimer mostrado en el documento imprimible del plan (auditoría
  // iteración 001, MEJORA-007). Configurable sin tocar el componente.
  disclaimer:  'Plan elaborado por un/a profesional de la nutrición. Este documento no sustituye una valoración médica presencial ni el criterio clínico individualizado.',
} as const;
