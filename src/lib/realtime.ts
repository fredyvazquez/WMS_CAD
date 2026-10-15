import { supabase } from './supabase';
import { useStore } from '../store/useStore';

export const CLIENT_ID = 'client_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();

let realtimeChannel: any = null;
let isSubscribed = false;

export const initRealtimeSync = () => {
  if (!supabase) {
    console.warn('⚡ [Realtime] Supabase no está configurado, omitiendo WebSocket.');
    return null;
  }

  if (realtimeChannel && isSubscribed) {
    return realtimeChannel;
  }

  console.log('⚡ [Realtime] Conectando a canal WebSocket de WMS Edison...');

  realtimeChannel = supabase.channel('wms-realtime-layout', {
    config: {
      broadcast: { self: false }
    }
  });

  // 1. Escuchar transmisiones directas vía WebSockets (latencia ultra baja < 100ms)
  realtimeChannel.on('broadcast', { event: 'layout_updated' }, ({ payload }: any) => {
    if (!payload || payload.senderId === CLIENT_ID) return;
    console.log('⚡ [WebSocket] Recibida actualización instantánea de otro usuario:', payload.senderId);

    const store = useStore.getState();
    store.applyRemoteUpdate(payload.branches, payload.articles);
  });

  // 2. Escuchar cambios de Postgres en la tabla layout_state
  realtimeChannel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'layout_state',
      filter: 'id=eq.default-layout'
    },
    (payload: any) => {
      console.log('⚡ [WebSocket Postgres] Cambio detectado en base de datos:', payload.eventType);
      const store = useStore.getState();
      if (!store.hasPendingLocalChanges && store.syncStatus !== 'saving') {
        store.loadFromCloud();
      }
    }
  );

  realtimeChannel.subscribe((status: string, err?: any) => {
    if (status === 'SUBSCRIBED') {
      isSubscribed = true;
      console.log('⚡ [WebSocket] Conexión Realtime activa y lista.');
    } else {
      isSubscribed = false;
      console.log('⚡ [WebSocket] Estado de conexión:', status, err || '');
    }
  });

  return realtimeChannel;
};

export const broadcastLayoutUpdate = (branches: any[], articles: any[]) => {
  if (!supabase) return;
  if (!realtimeChannel) {
    initRealtimeSync();
  }

  if (realtimeChannel) {
    realtimeChannel.send({
      type: 'broadcast',
      event: 'layout_updated',
      payload: {
        senderId: CLIENT_ID,
        timestamp: Date.now(),
        branches,
        articles
      }
    }).catch((err: any) => {
      console.warn('⚡ [WebSocket] Error al transmitir actualización:', err);
    });
  }
};
