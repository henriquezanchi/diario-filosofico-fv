// Funções puras compartilhadas entre o App e as telas carregadas sob demanda.

// Diz se uma tarefa recorrente cai na data informada (AAAA-MM-DD).
// É a mesma regra usada pelo servidor nos lembretes.
export function isTaskDueOn(task, dateKey) {
  const targetDate = new Date(dateKey + 'T12:00:00');
  if (!task.recurrence || task.recurrence === 'daily') return true;
  if (task.recurrence === 'weekly') return !!task.weekDays?.includes(targetDate.getDay());
  if (task.recurrence === 'monthly') return parseInt(task.monthDay) === targetDate.getDate();
  if (task.recurrence === 'biweekly' && task.baseDate) {
    const [y, m, d] = task.baseDate.split('-');
    const baseDateObj = new Date(y, m - 1, d);
    const todayObj = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const diffDays = Math.round((todayObj.getTime() - baseDateObj.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays % 14 === 0;
  }
  return true;
}


export function extractInviteCode(raw) {
  const trimmed = (raw || '').trim();
  const match = trimmed.match(/joinGroup=([^&\s]+)/);
  if (match) return decodeURIComponent(match[1]).toUpperCase();
  return trimmed.toUpperCase();
}
