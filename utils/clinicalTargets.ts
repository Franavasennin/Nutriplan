import { PatientData, Condition } from '../types';

/**
 * Objetivos nutricionales derivados de las condiciones clínicas del paciente
 * (auditoría — mejoras #5 y #6; ampliado en P-002.B, hallazgo A-3).
 *
 * Antes, las condiciones clínicas (hipertensión, celiaquía, intolerancia a
 * la lactosa...) solo se pasaban como texto libre a la IA, que podía o no
 * tenerlas en cuenta. Ahora se traducen a objetivos NUMÉRICOS deterministas
 * (sodio, fibra, azúcares libres), a EXCLUSIONES OBLIGATORIAS y a DIRECTIVAS
 * CLÍNICAS por condición que se imponen en el prompt independientemente de
 * lo que decida el modelo.
 *
 * P-002.B (iteración 003): hipotiroidismo, hipertiroidismo,
 * hipertrigliceridemia, DM1 y obesidad dejan de ir solo como texto libre —
 * cada una genera directivas deterministas con referencia (ATA, ESC/EAS,
 * ADA/ISPAD, SEEDO/EASO, KDIGO, AESAN). Como el resto de umbrales clínicos
 * del código: PENDIENTE DE VALIDACIÓN CLÍNICA por la DN (§4 auditoría 001).
 */

export interface ClinicalTargets {
  /** Sodio máximo (mg/día). OMS: <2000 mg. AHA/ESC en HTA: ~1500 mg. ERC: KDIGO 2021 <2 g/día (=2000, ya cubierto por el defecto). */
  sodiumMgMax: number;
  /** Fibra mínima (g/día). EFSA/OMS: ~14 g / 1000 kcal, suelo de 25 g. */
  fiberGMin: number;
  /** Azúcares libres máximos (g/día). OMS: <10% de la energía total; <5% en hipertrigliceridemia (recomendación condicional OMS + ESC/EAS). */
  addedSugarGMax: number;
  /** Alimentos que deben excluirse SIEMPRE por la condición clínica, no solo si el LLM lo interpreta así. */
  mandatoryExclusions: string[];
  /** Directivas clínicas deterministas por condición (P-002.B / A-3) — se inyectan en el prompt tal cual. */
  clinicalNotes: string[];
}

const DEFAULT_SODIUM_MG = 2000; // OMS: <2 g sodio/día (~5 g sal). También cumple KDIGO 2021 para ERC (<2 g/día) — ver nota renal abajo (resuelve M-3 por evidencia).
const HTN_SODIUM_MG     = 1500; // Hipertensión: más estricto (AHA/ESC)
const FIBER_G_PER_1000KCAL = 14;
const FIBER_G_FLOOR = 25;
const ADDED_SUGAR_ENERGY_FRACTION     = 0.10; // OMS: <10% de la energía total
const HTG_ADDED_SUGAR_ENERGY_FRACTION = 0.05; // Hipertrigliceridemia: <5% (OMS condicional; ESC/EAS 2019 — los azúcares elevan los TG)

export function getClinicalTargets(
  data: Pick<PatientData, 'conditions' | 'isPregnant'>,
  dailyCalories: number
): ClinicalTargets {
  const conditions = data.conditions ?? [];
  const hasHTG = conditions.includes(Condition.Hypertriglyceridemia);

  const sodiumMgMax = conditions.includes(Condition.Hypertension) ? HTN_SODIUM_MG : DEFAULT_SODIUM_MG;

  const fiberGMin = Math.max(FIBER_G_FLOOR, Math.round((dailyCalories / 1000) * FIBER_G_PER_1000KCAL));

  const sugarFraction = hasHTG ? HTG_ADDED_SUGAR_ENERGY_FRACTION : ADDED_SUGAR_ENERGY_FRACTION;
  const addedSugarGMax = Math.round((dailyCalories * sugarFraction) / 4);

  const mandatoryExclusions: string[] = [];
  const clinicalNotes: string[] = [];

  if (conditions.includes(Condition.Celiac)) {
    mandatoryExclusions.push(
      'gluten', 'trigo', 'cebada', 'centeno',
      'pan/pasta/harinas convencionales (usar solo versiones certificadas sin gluten)'
    );
  }
  if (conditions.includes(Condition.LactoseIntolerance)) {
    mandatoryExclusions.push(
      'leche y lácteos con lactosa (permitir productos sin lactosa o fermentados bajos en lactosa: yogur, queso curado)'
    );
  }

  // ── P-002.B / A-3: condiciones que antes iban solo como texto libre ────────

  if (hasHTG) {
    mandatoryExclusions.push('alcohol (contraindicado con triglicéridos elevados — cualquier cantidad los sube; ESC/EAS)');
    clinicalNotes.push(
      'HIPERTRIGLICERIDEMIA: azúcares libres ya limitados al 5% de la energía (OMS condicional / ESC-EAS). Prioriza pescado azul 2-3 veces/semana (omega-3 EPA/DHA), grasa predominante monoinsaturada (AOVE, frutos secos), y limita harinas refinadas, zumos y bebidas azucaradas.'
    );
  }

  if (conditions.includes(Condition.Hypothyroidism)) {
    clinicalNotes.push(
      'HIPOTIROIDISMO: si el paciente toma levotiroxina, el desayuno debe ir ≥30-60 min después de la toma, y los suplementos de calcio/hierro y la soja concentrada separados ≥4 h (interfieren su absorción — ATA). Asegurar yodo con sal yodada salvo indicación médica contraria. No hay que excluir crucíferas: cocinadas y en consumo normal son seguras.'
    );
  }

  if (conditions.includes(Condition.Hyperthyroidism)) {
    mandatoryExclusions.push('algas marinas (kelp, nori, wakame, espirulina — carga de yodo muy alta, contraindicada en hipertiroidismo; ATA)');
    clinicalNotes.push(
      'HIPERTIROIDISMO: evitar exceso de yodo (sin algas ni suplementos yodados). Moderar cafeína si hay palpitaciones. Cuidar calcio y vitamina D (el hipertiroidismo no controlado acelera la pérdida ósea — ATA): lácteos o alternativas fortificadas a diario.'
    );
  }

  if (conditions.includes(Condition.DiabetesType1)) {
    clinicalNotes.push(
      'DIABETES TIPO 1: cantidad de hidratos de carbono CONSISTENTE y explícita en cada toma — el paciente cuenta HC para dosificar insulina (ADA/ISPAD), así que cada toma debe declarar sus gramos de HC y mantenerse estable entre días. Índice glucémico bajo-medio preferente. Ninguna toma principal sin HC declarados. Incluir en generalGuidelines la pauta de hipoglucemia (regla 15/15: 15 g de HC rápidos, esperar 15 min, repetir si sigue <70 mg/dl).'
    );
  }

  if (conditions.includes(Condition.Obesity)) {
    clinicalNotes.push(
      'OBESIDAD: prioriza saciedad por volumen (verdura abundante en comida y cena), proteína suficiente en TODAS las tomas y fibra en el objetivo o por encima (SEEDO/EASO). EVITAR calorías líquidas: refrescos, zumos (aunque sean caseros) y alcohol — sacian poco y suman rápido.'
    );
  }

  if (conditions.includes(Condition.RenalDisease)) {
    // M-3 (auditoría 001) — resuelto por evidencia, no por cambio de número:
    // KDIGO 2021 (CKD) recomienda sodio <2 g/día = 2000 mg, exactamente el
    // valor por defecto de esta app. No procede endurecerlo a 1500 salvo
    // HTA concomitante (en cuyo caso la rama de HTA ya lo baja a 1500).
    clinicalNotes.push(
      'ENFERMEDAD RENAL (ERC): sodio ya limitado a ≤2000 mg/día (KDIGO 2021). El control de potasio y fósforo depende del estadio y la analítica — NO restringir por defecto frutas/verduras/legumbres sin indicación del profesional; señalar en generalGuidelines que potasio/fósforo los pauta su médico/nutricionista renal.'
    );
  }

  // ── Seguridad alimentaria en embarazo (AESAN) — exclusiones deterministas ──
  // Complementa P-002.A (micronutrientes): sin esto, un plan podría incluir
  // sushi o carpaccio a una embarazada (listeriosis/toxoplasmosis/mercurio).
  if (data.isPregnant) {
    mandatoryExclusions.push(
      'pescado crudo o ahumado en frío (sushi, sashimi, ceviche, salmón ahumado) — listeriosis (AESAN embarazo)',
      'carne cruda o poco hecha (carpaccio, tartar) y embutidos curados crudos (jamón, chorizo, salchichón) salvo cocinados — toxoplasmosis (AESAN)',
      'lácteos y quesos NO pasteurizados y quesos frescos/blandos de origen incierto — listeriosis (AESAN)',
      'patés y fiambres refrigerados, brotes crudos — listeriosis (AESAN)',
      'pez espada, atún rojo, tiburón y lucio — mercurio (AESAN embarazo)',
      'alcohol — cero en embarazo'
    );
  }

  return { sodiumMgMax, fiberGMin, addedSugarGMax, mandatoryExclusions, clinicalNotes };
}
