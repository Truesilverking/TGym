import { EXDB } from '../lib/exercises-data.js'

// The source catalogue is English. These ordered gym-vocabulary substitutions provide a useful
// Spanish title for every built-in movement (including future catalogue additions), while the
// curated names below override the most common exercises with their community-standard wording.
const phrases = [
  ['close grip', 'agarre cerrado'], ['wide grip', 'agarre amplio'], ['reverse grip', 'agarre inverso'],
  ['neutral grip', 'agarre neutro'], ['overhand grip', 'agarre prono'], ['underhand grip', 'agarre supino'],
  ['single arm', 'a un brazo'], ['one arm', 'a un brazo'], ['single leg', 'a una pierna'], ['one leg', 'a una pierna'],
  ['body weight', 'peso corporal'], ['medicine ball', 'balón medicinal'], ['stability ball', 'fitball'],
  ['resistance band', 'banda de resistencia'], ['smith machine', 'máquina Smith'], ['leverage machine', 'máquina de palanca'],
  ['bench press', 'press de banca'], ['chest press', 'press de pecho'], ['shoulder press', 'press de hombros'],
  ['military press', 'press militar'], ['leg press', 'prensa de piernas'], ['hip thrust', 'empuje de cadera'],
  ['glute bridge', 'puente de glúteos'], ['calf raise', 'elevación de pantorrillas'],
  ['lateral raise', 'elevación lateral'], ['front raise', 'elevación frontal'], ['leg raise', 'elevación de piernas'],
  ['pull-up', 'dominada'], ['pull up', 'dominada'], ['chin-up', 'dominada supina'], ['chin up', 'dominada supina'],
  ['push-up', 'flexión'], ['push up', 'flexión'], ['lat pulldown', 'jalón al pecho'], ['pulldown', 'jalón'],
  ['romanian deadlift', 'peso muerto rumano'], ['stiff leg deadlift', 'peso muerto con piernas rígidas'],
  ['straight leg deadlift', 'peso muerto con piernas rígidas'], ['deadlift', 'peso muerto'],
  ['split squat', 'sentadilla dividida'], ['hack squat', 'sentadilla hack'], ['sissy squat', 'sentadilla sissy'],
  ['russian twist', 'giro ruso'], ['sit-up', 'abdominal'], ['sit up', 'abdominal'],
  ['mountain climber', 'escalador'], ['jumping jack', 'salto de tijera'], ['battle rope', 'cuerda de batalla'],
  ['wrist curl', 'curl de muñeca'], ['leg curl', 'curl femoral'], ['biceps curl', 'curl de bíceps'],
  ['triceps extension', 'extensión de tríceps'], ['leg extension', 'extensión de cuádriceps']
]

const words = {
  barbell: 'barra', dumbbell: 'mancuerna', cable: 'polea', machine: 'máquina', band: 'banda', kettlebell: 'kettlebell',
  weighted: 'con peso', assisted: 'asistido', standing: 'de pie', seated: 'sentado', lying: 'acostado',
  incline: 'inclinado', inclined: 'inclinado', decline: 'declinado', kneeling: 'de rodillas', prone: 'boca abajo', supine: 'boca arriba',
  alternating: 'alterno', alternate: 'alterno', unilateral: 'unilateral', bilateral: 'bilateral', lateral: 'lateral', rear: 'posterior',
  squat: 'sentadilla', lunge: 'zancada', row: 'remo', curl: 'curl', extension: 'extensión', raise: 'elevación',
  press: 'press', fly: 'aperturas', dip: 'fondos', crunch: 'abdominal', plank: 'plancha', stretch: 'estiramiento',
  rotation: 'rotación', twist: 'giro', jump: 'salto', walk: 'caminata', walking: 'caminata', run: 'carrera', running: 'carrera',
  chest: 'pecho', back: 'espalda', shoulder: 'hombro', shoulders: 'hombros', biceps: 'bíceps', triceps: 'tríceps',
  forearm: 'antebrazo', forearms: 'antebrazos', wrist: 'muñeca', wrists: 'muñecas', hip: 'cadera', hips: 'caderas',
  glute: 'glúteo', glutes: 'glúteos', quadriceps: 'cuádriceps', quads: 'cuádriceps', hamstring: 'femoral', hamstrings: 'femorales',
  calf: 'pantorrilla', calves: 'pantorrillas', leg: 'pierna', legs: 'piernas', knee: 'rodilla', knees: 'rodillas',
  ankle: 'tobillo', ankles: 'tobillos', arm: 'brazo', arms: 'brazos', elbow: 'codo', elbows: 'codos',
  neck: 'cuello', waist: 'cintura', abdominal: 'abdominal', abs: 'abdominales', core: 'core',
  high: 'alto', low: 'bajo', inner: 'interno', outer: 'externo', forward: 'hacia delante', backward: 'hacia atrás',
  horizontal: 'horizontal', vertical: 'vertical', parallel: 'paralelo', overhead: 'sobre la cabeza',
  hold: 'isométrico', squeeze: 'contracción', roller: 'rueda', rope: 'cuerda', plate: 'disco', bench: 'banco', floor: 'suelo',
  with: 'con', without: 'sin', on: 'en', to: 'a', and: 'y', of: 'de', the: 'el', male: 'hombre', female: 'mujer'
}

function autoSpanishName(source) {
  let value = source.toLocaleLowerCase('en')
  for (const [from, to] of phrases) value = value.replaceAll(from, to)
  value = value.replace(/[a-z]+(?:'[a-z]+)?/g, token => words[token] || token)
  return value.replace(/\s+/g, ' ').replace(/\s+([,)])/g, '$1').replace(/([(])\s+/g, '$1').trim()
}

const generated = Object.fromEntries(EXDB.map(ex => [ex.id, autoSpanishName(ex.n)]))

const curated = {
  '0025': 'press de banca con barra', '0047': 'press inclinado con barra',
  '0426': 'press militar con mancuernas de pie', '0334': 'elevaciones laterales con mancuernas',
  '0241': 'extensión de tríceps en polea con barra V', '0251': 'fondos para pecho',
  '2330': 'jalón al pecho en polea', '0027': 'remo inclinado con barra',
  '1323': 'remo sentado en polea con cuerda', '0031': 'curl de bíceps con barra',
  '0313': 'curl martillo con mancuernas', '0043': 'sentadilla profunda con barra',
  '0085': 'peso muerto rumano con barra', '0739': 'prensa de piernas a 45 grados',
  '0585': 'extensión de cuádriceps en máquina', '0586': 'curl femoral acostado',
  '0605': 'elevación de pantorrillas de pie en máquina', '0289': 'press de banca con mancuernas',
  '0314': 'press inclinado con mancuernas', '0308': 'aperturas con mancuernas',
  '0319': 'aperturas inclinadas con mancuernas', '0574': 'remo inclinado en máquina',
  '0579': 'jalón frontal en máquina', '0588': 'remo sentado agarre cerrado en máquina',
  '0594': 'elevación de pantorrillas sentado en máquina', '0597': 'abducción de cadera en máquina',
  '0598': 'aducción de cadera en máquina', '0606': 'remo T en máquina',
  '0607': 'extensión de tríceps en máquina', '0652': 'dominadas',
  '0662': 'flexiones', '0674': 'dominadas supinas', '0685': 'correr',
  '0687': 'giro ruso', '0738': 'press de pantorrillas en prensa a 45 grados',
  '0743': 'sentadilla hack', '0748': 'press de banca en máquina Smith',
  '0757': 'press inclinado en máquina Smith', '0770': 'sentadilla en máquina Smith',
  '0774': 'press militar de pie en máquina Smith', '0811': 'peso muerto con barra hexagonal',
  '0814': 'fondos para tríceps', '0830': 'fondos en banco con peso',
  '0841': 'dominadas con peso', '0060': 'press francés acostado con barra',
  '0032': 'peso muerto convencional con barra', '0095': 'encogimientos con barra',
  '0120': 'remo al mentón con barra', '0294': 'curl de bíceps con mancuernas',
  '0410': 'sentadilla búlgara con mancuernas', '0499': 'remo invertido',
  '0549': 'swing con kettlebell'
}

export default { ...generated, ...curated }
