import test from 'node:test';
import assert from 'node:assert/strict';
import { nextStatus } from '../src/transitions';

test('iniciar a partir de ABERTA', () => {
  assert.deepEqual(nextStatus('ABERTA', 'iniciar'), { ok: true, to: 'EM_ATENDIMENTO' });
});
test('pausar exige motivo', () => {
  assert.equal(nextStatus('EM_ATENDIMENTO', 'pausar').ok, false);
  assert.equal(nextStatus('EM_ATENDIMENTO', 'pausar', 'falta de peça').ok, true);
});
test('concluir exige observação final', () => {
  assert.equal(nextStatus('PAUSADA', 'concluir').ok, false);
  assert.equal(nextStatus('PAUSADA', 'concluir', 'trocado o disjuntor').ok, true);
});
test('não retoma ocorrência concluída', () => {
  assert.equal(nextStatus('CONCLUIDA', 'retomar').ok, false);
});
