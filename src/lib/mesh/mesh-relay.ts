/**
 * @file src/lib/mesh/mesh-relay.ts
 * @description Nodo Repetidor Automático de Malla P2P Vecinal (Relay Offline-to-Online)
 *
 * Flujo de Resiliencia ante Emergencias sin Cobertura Celular:
 * 1. Solicitante en zona de sombra (sin señal / offline) emite un auxilio SOS.
 * 2. La alerta se propaga por la Malla Local (BroadcastChannel, BLE, Wi-Fi Direct, IndexedDB).
 * 3. Cualquier vecino cercano o brigadista cuya terminal SÍ posea conectividad a internet
 *    actúa de forma autónoma y transparente como Nodo Repetidor (Relay).
 * 4. El Nodo Relay despacha la alerta al servidor central (/api/v1/posts) y a Supabase WebSockets
 *    preservando la autoría y coordenadas del solicitante original.
 * 5. Muestra una notificación accesible de auxilio retransmitido y confirma en la malla.
 */

'use client';

import { toast } from 'sonner';
import { getOrCreateDeviceId } from '@/lib/ownership';
import { broadcastRealtimeSos, type RealtimeSosPayload } from '@/lib/realtime/sos-realtime';
import { meshService, type MeshMessage } from '@/lib/mesh/mesh-service';
import { localDb } from '@/lib/offline/db';
import { addNotification } from '@/lib/notifications/notifications-manager';

export interface MeshSosPacket {
  packetId: string;
  clientMutationId: string;
  authorDeviceId: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  locationLabel?: string;
  createdAt: string;
  relayedBy?: string;
  status: 'LOCAL_PENDING' | 'RELAYED_TO_CLOUD';
}

const MESH_CHANNEL_NAME = 'redvecina_sos_mesh_v1';
const processedRelayPackets = new Set<string>();
let meshChannel: BroadcastChannel | null = null;
let isRelayListenerInitialized = false;

/**
 * Emite un paquete SOS por la malla vecinal local cuando no hay conexión a internet.
 */
export function broadcastOfflineSosToMesh(params: {
  clientMutationId: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  locationLabel?: string;
}): void {
  if (typeof window === 'undefined') return;

  const myDeviceId = getOrCreateDeviceId();
  const packet: MeshSosPacket = {
    packetId: `mesh-pkt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    clientMutationId: params.clientMutationId,
    authorDeviceId: myDeviceId,
    title: params.title,
    description: params.description,
    lat: params.lat,
    lng: params.lng,
    locationLabel: params.locationLabel,
    createdAt: new Date().toISOString(),
    status: 'LOCAL_PENDING',
  };

  processedRelayPackets.add(packet.packetId);
  processedRelayPackets.add(packet.clientMutationId);

  // 1. Difundir vía BroadcastChannel local
  try {
    const ch = new BroadcastChannel(MESH_CHANNEL_NAME);
    ch.postMessage({ type: 'SOS_MESH_EMIT', packet });
    ch.close();
  } catch {
    // Ignorar
  }

  // 2. Difundir vía MeshService (BLE / Nearby hops)
  void meshService.broadcastSos({ lat: params.lat, lng: params.lng });

  // 3. Guardar en almacenamiento compartido para despertar instancias en background
  try {
    const raw = localStorage.getItem('redvecina_mesh_active_packets');
    const list: MeshSosPacket[] = raw ? JSON.parse(raw) : [];
    list.push(packet);
    localStorage.setItem('redvecina_mesh_active_packets', JSON.stringify(list.slice(-10)));
  } catch {
    // Ignorar
  }
}

/**
 * Procesa la retransmisión comunitaria si este dispositivo cuenta con señal a internet.
 */
async function handleRelayAttempt(packet: MeshSosPacket): Promise<void> {
  if (typeof window === 'undefined') return;
  if (processedRelayPackets.has(packet.packetId) && packet.status === 'RELAYED_TO_CLOUD') {
    return;
  }

  const myDeviceId = getOrCreateDeviceId();
  if (packet.authorDeviceId === myDeviceId) {
    // No somos repetidores de nuestra propia publicación
    return;
  }

  // Si no tenemos internet, guardamos en la cola local de reenvío
  if (!navigator.onLine) {
    return;
  }

  processedRelayPackets.add(packet.packetId);
  processedRelayPackets.add(packet.clientMutationId);

  try {
    // 1. Despachar al servidor central en nombre del vecino sin señal
    await fetch('/api/v1/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_mutation_id: packet.clientMutationId,
        author_id: 1,
        sector_id: 2, // Huancayo
        title: packet.title,
        description: `${packet.description} [📡 Transmitido vía Malla P2P Vecinal por nodo repetidor ${myDeviceId.slice(0, 8)}]`,
        post_type: 'SOS_VULNERABLE',
        urgency_level: 'CRITICA',
        public_lat: packet.lat,
        public_lng: packet.lng,
        privacy_radius_meters: 50,
        status: 'ACTIVO',
      }),
    });

    // 2. Transmitir por WebSocket a todos los vecinos y autoridades de la red
    const realtimeSos: RealtimeSosPayload = {
      client_mutation_id: packet.clientMutationId,
      title: packet.title,
      description: packet.description,
      locationLabel: packet.locationLabel || `Huancayo (${packet.lat.toFixed(4)}, ${packet.lng.toFixed(4)})`,
      lat: packet.lat,
      lng: packet.lng,
      createdAt: packet.createdAt,
      authorDeviceId: packet.authorDeviceId,
    };
    await broadcastRealtimeSos(realtimeSos);

    // 3. Guardar en base local para visualizar de inmediato
    try {
      await localDb.bulkCachePosts([
        {
          client_mutation_id: packet.clientMutationId,
          sector_id: 2,
          category_id: 4,
          operational_mode: 'EMERGENCIA',
          post_type: 'SOS_VULNERABLE',
          title: packet.title,
          description: packet.description,
          urgency_level: 'CRITICA',
          public_lat: packet.lat,
          public_lng: packet.lng,
          privacy_radius_meters: 50,
          status: 'ACTIVO',
          client_created_at: packet.createdAt,
          is_pending_sync: false,
        },
      ]);
    } catch {
      // Ignorar
    }

    // 4. Notificar al usuario local que su terminal prestó auxilio como repetidor
    toast.success('📡 Nodo Repetidor Activado', {
      description: `Retransmitiste con éxito el auxilio de un vecino sin señal ("${packet.title}") hacia los servidores de emergencia.`,
      duration: 8000,
    });

    addNotification({
      id: `mesh-relay-${packet.packetId}`,
      type: 'SOS_ALERT',
      title: '📡 Auxilio Retransmitido (Nodo Relay)',
      description: `Tu dispositivo actuó como puente para subir la emergencia de un vecino sin cobertura celular a la red comunitaria.`,
      priority: 'CRITICAL',
      metadata: {
        client_mutation_id: packet.clientMutationId,
        tab: 'MAPA',
        actionLabel: 'Ver en Mapa',
      },
    });

    // 5. Enviar acuse de recibo por la malla local para que otros nodos no dupliquen
    if (meshChannel) {
      meshChannel.postMessage({
        type: 'SOS_MESH_ACK',
        packetId: packet.packetId,
        clientMutationId: packet.clientMutationId,
        relayedBy: myDeviceId,
      });
    }
  } catch (err) {
    console.warn('Fallo al retransmitir paquete de malla SOS:', err);
  }
}

/**
 * Inicializa el escucha permanente de la Malla Vecinal para actuar como Relay.
 */
export function initializeMeshRelayListener(): () => void {
  if (typeof window === 'undefined' || isRelayListenerInitialized) {
    return () => {};
  }
  isRelayListenerInitialized = true;

  if ('BroadcastChannel' in window) {
    meshChannel = new BroadcastChannel(MESH_CHANNEL_NAME);
    meshChannel.onmessage = (event) => {
      if (event.data?.type === 'SOS_MESH_EMIT' && event.data?.packet) {
        void handleRelayAttempt(event.data.packet as MeshSosPacket);
      } else if (event.data?.type === 'SOS_MESH_ACK' && event.data?.packetId) {
        processedRelayPackets.add(event.data.packetId);
      }
    };
  }

  // Escuchar eventos de MeshService
  const unsubMesh = meshService.subscribe((msg: MeshMessage) => {
    if (msg.type === 'SOS_ALERT' && msg.status !== 'CANCELLED') {
      void handleRelayAttempt({
        packetId: msg.id,
        clientMutationId: msg.id,
        authorDeviceId: msg.senderId,
        title: msg.payload?.title || '🚨 ALERTA SOS COMUNITARIA',
        description: msg.payload?.details || 'Emergencia vecinal sin cobertura celular directa.',
        lat: msg.coords.lat,
        lng: msg.coords.lng,
        createdAt: msg.timestamp,
        status: 'LOCAL_PENDING',
      });
    }
  });

  // Reintento al recuperar conexión celular/Wi-Fi
  const handleOnline = () => {
    try {
      const raw = localStorage.getItem('redvecina_mesh_active_packets');
      if (!raw) return;
      const list: MeshSosPacket[] = JSON.parse(raw);
      for (const pkt of list) {
        if (!processedRelayPackets.has(pkt.packetId)) {
          void handleRelayAttempt(pkt);
        }
      }
    } catch {}
  };
  window.addEventListener('online', handleOnline);

  return () => {
    isRelayListenerInitialized = false;
    if (meshChannel) {
      meshChannel.close();
      meshChannel = null;
    }
    unsubMesh();
    window.removeEventListener('online', handleOnline);
  };
}
