const COPY = {
  en: {
    restTitle: 'Rest over 💪',
    restBody: 'Time for your next set.',
    workTitle: 'Work timer finished',
    workBody: 'Your timed set is complete. Return to your workout.',
    testBody: 'Test notification ✅ — this is what alerts look like.',
    dayFallbackTitle: 'Workout planned today',
    dayRoutineSuffix: 'today',
    dayBody: "It's on your plan — let's go 💪",
  },
  es: {
    restTitle: 'Descanso terminado',
    restBody: 'Hora de la siguiente serie.',
    workTitle: 'Temporizador terminado',
    workBody: 'Tu serie cronometrada ha terminado. Vuelve a tu entrenamiento.',
    testBody: 'Notificación de prueba: así se muestran los avisos de TGym.',
    dayFallbackTitle: 'Entrenamiento programado para hoy',
    dayRoutineSuffix: 'hoy',
    dayBody: 'Tu rutina está lista en el calendario de entrenamiento.',
  },
  'pt-BR': {
    restTitle: 'Descanso terminado 💪',
    restBody: 'Hora da próxima série.',
    workTitle: 'Cronômetro terminado',
    workBody: 'Sua série cronometrada terminou. Volte ao treino.',
    testBody: 'Notificação de teste ✅ — é assim que os alertas aparecem.',
    dayFallbackTitle: 'Treino planejado para hoje',
    dayRoutineSuffix: 'hoje',
    dayBody: 'Está no seu plano — vamos treinar 💪',
  },
};

const copyFor = lang => COPY[lang] || COPY.en;

export function restTimerPush(lang) {
  const copy = copyFor(lang);
  return { title: copy.restTitle, body: copy.restBody, tag: 'rest-timer' };
}

export function workTimerPush(lang) {
  const copy = copyFor(lang);
  return { title: copy.workTitle, body: copy.workBody, tag: 'work-timer' };
}

export function testPush(lang) {
  return { title: 'TGym', body: copyFor(lang).testBody, tag: 'test' };
}

export function dayReminderPush(lang, routine) {
  const copy = copyFor(lang);
  return {
    title: routine
      ? `${routine.emoji || '🏋️'} ${routine.name} ${copy.dayRoutineSuffix}`
      : copy.dayFallbackTitle,
    body: copy.dayBody,
    tag: 'day-reminder',
  };
}
