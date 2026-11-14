import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

// Registra o aparelho para receber push nativo (FCM/APNs via Expo). Requer aparelho fisico.
export async function registerPush() {
  try {
    if (!Device.isDevice) return;
    if (Platform.OS === 'android')
      await Notifications.setNotificationChannelAsync('default', { name: 'Ocorrências', importance: Notifications.AndroidImportance.HIGH });
    const perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return;
    const t = await Notifications.getExpoPushTokenAsync();
    await api('/push-token', { token: t.data });
  } catch { /* push e opcional; o app segue com WebSocket */ }
}
