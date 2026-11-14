// Carga e pico de shopping: k6 run -e API=http://localhost:3000 -e PASSWORD=operia123 loadtest/k6.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    rotina: { executor: 'constant-vus', vus: 20, duration: '2m' },
    pico: { executor: 'ramping-vus', startTime: '2m', startVUs: 20, stages: [{ duration: '1m', target: 150 }, { duration: '2m', target: 150 }, { duration: '30s', target: 0 }] },
  },
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<800'] },
};
const API = __ENV.API || 'http://localhost:3000';
const H = t => ({ headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` } });

export function setup() {
  const login = u => http.post(`${API}/auth/login`, JSON.stringify({ login: u, password: __ENV.PASSWORD || 'operia123' }), { headers: { 'Content-Type': 'application/json' } }).json().token;
  const admin = login('admin@operia.mall');
  const cat = http.get(`${API}/catalog`, H(admin)).json();
  return { admin, field: login('limpeza@operia.mall'), cat };
}
export default function (d) {
  const r = Math.random();
  if (r < 0.2) {
    const res = http.post(`${API}/occurrences`, JSON.stringify({
      category_id: d.cat.categories[Math.floor(Math.random() * d.cat.categories.length)].id,
      location_id: d.cat.locations[Math.floor(Math.random() * d.cat.locations.length)].id,
      description: 'Carga: lâmpada queimada no corredor ' + Math.random(),
    }), H(d.field));
    check(res, { 'criou 201': x => x.status === 201 });
  } else if (r < 0.7) {
    check(http.get(`${API}/occurrences?size=20`, H(d.admin)), { 'fila 200': x => x.status === 200 });
  } else {
    check(http.get(`${API}/metrics`, H(d.admin)), { 'metricas 200': x => x.status === 200 });
  }
  sleep(1);
}
