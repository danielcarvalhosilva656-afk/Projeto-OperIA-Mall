import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, AccessibilityInfo } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { API, api, enqueue, flushQueue, getToken, NetworkError, readQueue, setToken, uploadAttachment } from './api';
import { C, STATUS } from './theme';

export interface User { id: number; role: string; team_id: number | null; name: string }

const Btn = ({ title, onPress, alt, disabled, hint }: { title: string; onPress: () => void; alt?: boolean; disabled?: boolean; hint?: string }) => (
  <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={title} accessibilityHint={hint}
    accessibilityState={{ disabled }} style={[s.btn, alt && s.btnAlt, disabled && { opacity: 0.6 }]}>
    <Text style={[s.btnTxt, alt && { color: C.brand }]}>{title}</Text>
  </Pressable>
);
const Prio = ({ p }: { p: string }) => {
  const x = C.prio[p];
  return <View style={[s.badge, { backgroundColor: x.bg, borderColor: x.fg }]} accessible accessibilityLabel={`Prioridade ${x.label}`}><Text style={{ color: x.fg, fontWeight: '700' }}>{x.icon} {x.label}</Text></View>;
};
const Err = ({ msg }: { msg: string }) => msg ? <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={s.err}>{msg}</Text> : null;

// ---------------- M01 Login ----------------
export function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [login, setLogin] = useState(''); const [password, setPassword] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function go() {
    setErr(''); setBusy(true);
    try { const r = await api('/auth/login', { login, password }); await setToken(r.token); onLogin(r.user); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <ScrollView contentContainerStyle={[s.page, { justifyContent: 'center', flexGrow: 1 }]} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={s.h1}>OperIA Mall</Text>
      <Text style={s.label}>E-mail ou matrícula</Text>
      <TextInput style={s.input} value={login} onChangeText={setLogin} autoCapitalize="none" autoComplete="username" accessibilityLabel="E-mail ou matrícula" />
      <Text style={s.label}>Senha</Text>
      <TextInput style={s.input} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" accessibilityLabel="Senha" />
      <Err msg={err} />
      <Btn title={busy ? 'Entrando…' : 'Entrar'} onPress={go} disabled={busy} />
    </ScrollView>
  );
}

// ---------------- M02 Fila de tarefas ----------------
const TABS = [{ id: 'ABERTA', label: 'Abertas', st: ['ABERTA'] }, { id: 'ATEND', label: 'Em atendimento', st: ['EM_ATENDIMENTO', 'PAUSADA'] }, { id: 'CONCL', label: 'Concluídas', st: ['CONCLUIDA'] }];

export function Queue({ user, onOpen, onNew, onLogout }: { user: User; onOpen: (id: number) => void; onNew: () => void; onLogout: () => void }) {
  const [tab, setTab] = useState('ABERTA'); const [items, setItems] = useState<any[]>([]); const [pending, setPending] = useState(0); const [err, setErr] = useState(''); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      if (await flushQueue()) AccessibilityInfo.announceForAccessibility('Ocorrências pendentes foram enviadas.');
      setPending((await readQueue()).length);
      const r = await api('/occurrences?size=100'); setItems(r.items); setErr('');
    } catch (e: any) { setErr(e instanceof NetworkError ? 'Sem conexão. Exibindo dados já carregados.' : e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Tempo real (WebSocket com reconexao)
  useEffect(() => {
    let ws: WebSocket | null = null; let stop = false; let retry = 1000;
    const connect = () => {
      ws = new WebSocket(API.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(getToken()));
      ws.onopen = () => { retry = 1000; load(); };
      ws.onmessage = e => { const ev = JSON.parse(e.data); if (ev.type === 'notification') AccessibilityInfo.announceForAccessibility(ev.content); if (String(ev.type).startsWith('occurrence.') || ev.type === 'notification') load(); };
      ws.onclose = () => { if (!stop) setTimeout(connect, (retry = Math.min(retry * 2, 15000))); };
    };
    connect(); return () => { stop = true; ws?.close(); };
  }, [load]);

  const cur = TABS.find(t => t.id === tab)!;
  const list = items.filter(o => cur.st.includes(o.status));
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.header}>
        <View style={{ flex: 1 }}><Text accessibilityRole="header" style={s.h2}>{user.name}</Text><Text style={{ color: C.muted }}>Perfil: {user.role}{pending ? ` · ${pending} pendente(s) de envio` : ''}</Text></View>
        <Btn title="Sair" alt onPress={onLogout} />
      </View>
      <View style={s.tabs} accessibilityRole="tablist">
        {TABS.map(t => (
          <Pressable key={t.id} onPress={() => setTab(t.id)} accessibilityRole="tab" accessibilityState={{ selected: tab === t.id }} style={[s.tab, tab === t.id && s.tabOn]}>
            <Text style={[s.tabTxt, tab === t.id && { color: C.brandInk }]}>{t.label}</Text></Pressable>))}
      </View>
      <Err msg={err} />
      {loading ? <ActivityIndicator accessibilityLabel="Carregando" size="large" style={{ margin: 24 }} /> :
        <FlatList data={list} keyExtractor={o => String(o.id)} onRefresh={load} refreshing={false} contentContainerStyle={{ padding: 12, gap: 10 }}
          ListEmptyComponent={<Text style={{ color: C.muted, padding: 16 }}>Nenhum chamado nesta aba.</Text>}
          renderItem={({ item: o }) => (
            <Pressable onPress={() => onOpen(o.id)} style={s.card} accessibilityRole="button"
              accessibilityLabel={`${o.protocol}. Prioridade ${C.prio[o.priority].label}. ${o.category_name} em ${o.sector}. Status ${STATUS[o.status]}.`} accessibilityHint="Abre os detalhes e ações do chamado">
              <Prio p={o.priority} /><Text style={s.cardT}>{o.category_name} — {o.sector}</Text>
              <Text style={{ color: C.muted }}>{o.protocol} · {o.floor} · {STATUS[o.status]}</Text></Pressable>)} />}
      <Pressable onPress={onNew} style={s.fab} accessibilityRole="button" accessibilityLabel="Nova ocorrência" accessibilityHint="Abre o formulário de registro"><Text style={{ color: C.brandInk, fontSize: 30 }}>＋</Text></Pressable>
    </View>
  );
}

// ---------------- M03 Registro ----------------
const Chips = ({ label, options, value, onChange }: { label: string; options: { id: string | number; text: string }[]; value: any; onChange: (v: any) => void }) => (
  <View accessibilityRole="radiogroup" accessibilityLabel={label}>
    <Text style={s.label}>{label}</Text>
    <View style={s.chips}>{options.map(o => (
      <Pressable key={o.id} onPress={() => onChange(o.id)} accessibilityRole="radio" accessibilityState={{ checked: value === o.id }} accessibilityLabel={o.text} style={[s.chip, value === o.id && s.chipOn]}>
        <Text style={{ color: value === o.id ? C.brandInk : C.ink, fontWeight: '700' }}>{o.text}</Text></Pressable>))}</View>
  </View>
);

export function Register({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [cat, setCat] = useState<any>(null); const [categoryId, setCategoryId] = useState<number | null>(null);
  const [floor, setFloor] = useState<string | null>(null); const [sector, setSector] = useState<string | null>(null); const [locId, setLocId] = useState<number | null>(null);
  const [text, setText] = useState(''); const [files, setFiles] = useState<{ uri: string; mime: string; name: string }[]>([]);
  const [rec, setRec] = useState<Audio.Recording | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { api('/catalog').then(setCat).catch(e => setErr(e.message)); }, []);

  const locs: any[] = cat?.locations || [];
  const floors = [...new Set(locs.map(l => l.floor))];
  const sectors = [...new Set(locs.filter(l => l.floor === floor).map(l => l.sector))];
  const refs = locs.filter(l => l.floor === floor && l.sector === sector);

  async function pick(camera: boolean) {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setErr('Permissão negada para acessar câmera/galeria.');
    const r = camera ? await ImagePicker.launchCameraAsync({ quality: 0.6 }) : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (r.canceled) return;
    const a = r.assets[0]; const png = a.uri.toLowerCase().endsWith('.png');
    setFiles(f => [...f, { uri: a.uri, mime: png ? 'image/png' : 'image/jpeg', name: png ? 'foto.png' : 'foto.jpg' }]);
  }
  async function toggleRec() {
    try {
      if (rec) {
        await rec.stopAndUnloadAsync(); const uri = rec.getURI(); setRec(null);
        if (uri) { setFiles(f => [...f, { uri, mime: 'audio/mp4', name: 'audio.m4a' }]); AccessibilityInfo.announceForAccessibility('Áudio gravado e anexado.'); }
      } else {
        const p = await Audio.requestPermissionsAsync(); if (!p.granted) return setErr('Permissão de microfone negada.');
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY); setRec(recording);
        AccessibilityInfo.announceForAccessibility('Gravando.');
      }
    } catch { setErr('Não foi possível usar o microfone.'); }
  }
  async function send() {
    setErr('');
    if (!categoryId || !locId) return setErr('Selecione a categoria e a localização completa (piso, setor e ponto de referência).');
    if (text.trim().length < 3 && !files.some(f => f.mime.startsWith('audio'))) return setErr('Descreva a ocorrência por texto ou áudio.');
    setBusy(true);
    const body = { category_id: categoryId, location_id: locId, description: text.trim() || 'Ocorrência registrada por áudio (ver anexo).' };
    try {
      const occ = await api('/occurrences', body);
      for (const f of files) await uploadAttachment(occ.id, f.uri, f.mime, f.name);
      Alert.alert('Ocorrência registrada', `Protocolo ${occ.protocol}`); onDone();
    } catch (e: any) {
      if (e instanceof NetworkError) {
        await enqueue({ key: String(Date.now()), body, files });
        Alert.alert('Sem conexão', 'A ocorrência foi salva no aparelho e será enviada quando houver sinal.'); onDone();
      } else setErr(e.message);
    } finally { setBusy(false); }
  }
  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <Btn title="Voltar" alt onPress={onBack} />
      <Text accessibilityRole="header" style={s.h1}>Nova ocorrência</Text>
      <Chips label="Categoria" options={(cat?.categories || []).map((c: any) => ({ id: c.id, text: c.name }))} value={categoryId} onChange={setCategoryId} />
      <Chips label="Piso" options={floors.map(f => ({ id: f, text: f }))} value={floor} onChange={(v: string) => { setFloor(v); setSector(null); setLocId(null); }} />
      {floor && <Chips label="Setor" options={sectors.map(x => ({ id: x, text: x }))} value={sector} onChange={(v: string) => { setSector(v); setLocId(null); }} />}
      {sector && <Chips label="Ponto de referência" options={refs.map(l => ({ id: l.id, text: l.reference }))} value={locId} onChange={setLocId} />}
      <Text style={s.label}>Descrição</Text>
      <TextInput style={[s.input, { minHeight: 96, textAlignVertical: 'top' }]} multiline value={text} onChangeText={setText} accessibilityLabel="Descrição da ocorrência" />
      <View style={s.chips}>
        <Btn title={rec ? 'Parar gravação' : 'Gravar áudio'} alt onPress={toggleRec} hint="Grava uma descrição por voz" />
        <Btn title="Tirar foto" alt onPress={() => pick(true)} />
        <Btn title="Galeria" alt onPress={() => pick(false)} />
      </View>
      {files.length > 0 && <Text accessibilityLiveRegion="polite" style={{ color: C.muted }}>{files.length} anexo(s) adicionado(s).</Text>}
      <Err msg={err} />
      <Btn title={busy ? 'Enviando…' : 'Enviar ocorrência'} onPress={send} disabled={busy} />
    </ScrollView>
  );
}

// ---------------- M04 Detalhes e execução ----------------
export function Detail({ id, onBack }: { id: number; onBack: () => void }) {
  const [o, setO] = useState<any>(null); const [note, setNote] = useState(''); const [err, setErr] = useState(''); const [ask, setAsk] = useState<null | 'pausar' | 'concluir'>(null);
  const load = useCallback(() => api(`/occurrences/${id}`).then(setO).catch(e => setErr(e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  async function act(action: string) {
    setErr('');
    try { await api(`/occurrences/${id}/status`, { action, note: note.trim() || undefined }); setAsk(null); setNote(''); await load(); AccessibilityInfo.announceForAccessibility('Status atualizado.'); }
    catch (e: any) { setErr(e.message); }
  }
  if (!o) return <View style={s.page}><Btn title="Voltar" alt onPress={onBack} /><Err msg={err} /><ActivityIndicator accessibilityLabel="Carregando" /></View>;
  const st = o.status;
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={s.page}>
        <Btn title="Voltar" alt onPress={onBack} />
        <Text accessibilityRole="header" style={s.h1}>{o.protocol}</Text>
        <Prio p={o.priority} /><Text style={s.cardT}>{STATUS[st]} · {o.category_name}</Text>
        <Text>{o.description}</Text>
        <Text style={{ color: C.muted }}>{o.floor} · {o.sector} · {o.reference}</Text>
        {o.attachments.filter((a: any) => a.kind === 'IMAGEM').map((a: any, i: number) =>
          <Image key={a.id} source={{ uri: API + a.url }} accessibilityLabel={`Foto ${i + 1} anexada ao chamado`} style={{ width: '100%', height: 200, borderRadius: 6 }} resizeMode="cover" />)}
        <Text accessibilityRole="header" style={s.h2}>Histórico</Text>
        {o.history.map((h: any) => (
          <View key={h.id} style={s.hist} accessible><Text style={{ fontWeight: '700', color: C.ink }}>{h.kind}{h.to_value ? `: ${h.from_value ?? '—'} → ${h.to_value}` : ''}</Text>
            <Text style={{ color: C.muted }}>{h.author_name} · {new Date(h.created_at).toLocaleString('pt-BR')}</Text>{h.note ? <Text>{h.note}</Text> : null}</View>))}
        {ask && <>
          <Text style={s.label}>{ask === 'pausar' ? 'Motivo da pausa (obrigatório)' : 'Observação final (obrigatória)'}</Text>
          <TextInput style={[s.input, { minHeight: 80 }]} multiline value={note} onChangeText={setNote} accessibilityLabel={ask === 'pausar' ? 'Motivo da pausa' : 'Observação final'} />
        </>}
        <Err msg={err} />
      </ScrollView>
      {st !== 'CONCLUIDA' && (
        <View style={s.bar}>
          {st === 'ABERTA' && <Btn title="Iniciar" onPress={() => act('iniciar')} />}
          {st === 'PAUSADA' && <Btn title="Retomar" onPress={() => act('retomar')} />}
          {st === 'EM_ATENDIMENTO' && <Btn title={ask === 'pausar' ? 'Confirmar pausa' : 'Pausar'} alt onPress={() => (ask === 'pausar' ? act('pausar') : setAsk('pausar'))} />}
          {(st === 'EM_ATENDIMENTO' || st === 'PAUSADA') && <Btn title={ask === 'concluir' ? 'Confirmar conclusão' : 'Concluir'} onPress={() => (ask === 'concluir' ? act('concluir') : setAsk('concluir'))} />}
        </View>)}
    </View>
  );
}

const s = StyleSheet.create({
  page: { padding: 16, gap: 10, backgroundColor: C.bg },
  h1: { fontSize: 26, fontWeight: '700', color: C.ink }, h2: { fontSize: 18, fontWeight: '700', color: C.ink },
  label: { fontWeight: '700', color: C.ink, marginTop: 6 },
  input: { borderWidth: 2, borderColor: C.line, borderRadius: 6, padding: 12, backgroundColor: C.surface, color: C.ink, fontSize: 16, minHeight: 48 },
  btn: { backgroundColor: C.brand, borderColor: C.brand, borderWidth: 2, borderRadius: 6, paddingHorizontal: 16, minHeight: 48, justifyContent: 'center', alignItems: 'center', flexGrow: 1 },
  btnAlt: { backgroundColor: C.surface }, btnTxt: { color: C.brandInk, fontWeight: '700', fontSize: 16 },
  err: { backgroundColor: '#fde8e8', color: C.danger, borderColor: C.danger, borderWidth: 2, borderRadius: 6, padding: 10, fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, backgroundColor: C.surface },
  tabs: { flexDirection: 'row', backgroundColor: C.surface, paddingHorizontal: 8, paddingBottom: 8, gap: 6 },
  tab: { flex: 1, minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 6, borderWidth: 2, borderColor: C.brand },
  tabOn: { backgroundColor: C.brand }, tabTxt: { fontWeight: '700', color: C.brand, textAlign: 'center' },
  card: { backgroundColor: C.surface, borderRadius: 8, padding: 14, gap: 6, borderWidth: 1, borderColor: C.line },
  cardT: { fontSize: 17, fontWeight: '700', color: C.ink },
  badge: { alignSelf: 'flex-start', borderWidth: 2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 64, height: 64, borderRadius: 32, backgroundColor: C.brand, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 24, borderWidth: 2, borderColor: C.brand, backgroundColor: C.surface },
  chipOn: { backgroundColor: C.brand },
  hist: { borderLeftWidth: 4, borderLeftColor: C.line, paddingLeft: 10 },
  bar: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: C.surface, borderTopWidth: 2, borderTopColor: C.line },
});
