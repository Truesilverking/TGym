import test from 'node:test';
import assert from 'node:assert/strict';
import { dayReminderPush, restTimerPush, workTimerPush, testPush } from './push-messages.js';

test('localizes every server-generated notification in pt-BR', () => {
  assert.deepEqual(restTimerPush('pt-BR'), {
    title: 'Descanso terminado 💪',
    body: 'Hora da próxima série.',
    tag: 'rest-timer',
  });
  assert.deepEqual(testPush('pt-BR'), {
    title: 'TGym',
    body: 'Notificação de teste ✅ — é assim que os alertas aparecem.',
    tag: 'test',
  });
  assert.deepEqual(dayReminderPush('pt-BR', { name: 'Treino A', emoji: '💪' }), {
    title: '💪 Treino A hoje',
    body: 'Está no seu plano — vamos treinar 💪',
    tag: 'day-reminder',
  });
});

test('uses Spanish copy and TGym branding for external alerts without changing notification identity', () => {
  assert.deepEqual(restTimerPush('es'), {title:'Descanso terminado',body:'Hora de la siguiente serie.',tag:'rest-timer'});
  assert.equal(testPush('es').title,'TGym');
  assert.equal(testPush('es').tag,'test');
  assert.deepEqual(dayReminderPush('es',{name:'Rutina A',emoji:'🏋️'}), {title:'🏋️ Rutina A hoy',body:'Tu rutina está lista en el calendario de entrenamiento.',tag:'day-reminder'});
});

test('keeps the existing English copy as the fallback', () => {
  assert.deepEqual(restTimerPush('fr'), restTimerPush('en'));
  assert.equal(dayReminderPush('unknown', null).title, 'Workout planned today');
  assert.equal(testPush(undefined).body, 'Test notification ✅ — this is what alerts look like.');
});

test('work timer notifications remain distinct from rest and localize every supported language', () => {
  assert.deepEqual(workTimerPush('es'), { title:'Temporizador terminado', body:'Tu serie cronometrada ha terminado. Vuelve a tu entrenamiento.', tag:'work-timer' });
  assert.deepEqual(workTimerPush('pt-BR'), { title:'Cronômetro terminado', body:'Sua série cronometrada terminou. Volte ao treino.', tag:'work-timer' });
  assert.deepEqual(workTimerPush('unknown'), { title:'Work timer finished', body:'Your timed set is complete. Return to your workout.', tag:'work-timer' });
});
