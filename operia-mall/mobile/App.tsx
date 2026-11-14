import { useEffect, useState } from 'react';
import { SafeAreaView, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { api, loadToken, setToken } from './src/api';
import { registerPush } from './src/push';
import { Detail, Login, Queue, Register, User } from './src/screens';

type Screen = { name: 'queue' } | { name: 'new' } | { name: 'detail'; id: number };

export default function App() {
  const [user, setUser] = useState<User | null>(null); const [ready, setReady] = useState(false); const [screen, setScreen] = useState<Screen>({ name: 'queue' });
  useEffect(() => { (async () => { try { if (await loadToken()) setUser(await api('/me')); } catch { await setToken(''); } setReady(true); })(); }, []);
  useEffect(() => { if (user) registerPush(); }, [user]);
  if (!ready) return <ActivityIndicator accessibilityLabel="Carregando" style={{ flex: 1 }} />;
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      {!user ? <Login onLogin={u => { setUser(u); setScreen({ name: 'queue' }); }} /> :
        screen.name === 'new' ? <Register onDone={() => setScreen({ name: 'queue' })} onBack={() => setScreen({ name: 'queue' })} /> :
        screen.name === 'detail' ? <Detail id={screen.id} onBack={() => setScreen({ name: 'queue' })} /> :
        <Queue user={user} onOpen={id => setScreen({ name: 'detail', id })} onNew={() => setScreen({ name: 'new' })} onLogout={async () => { await setToken(''); setUser(null); }} />}
    </SafeAreaView>
  );
}
