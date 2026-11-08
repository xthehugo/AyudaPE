/**
 * MeshService - Protocolo de Malla P2P Vecinal (Wi-Fi Direct / Bluetooth Low Energy)
 *
 * Simulación de red mallada descentralizada ad-hoc para emergencias barriales:
 * - Asigna ID de mensaje único (UUIDv4), marca de tiempo y geoposición aproximada.
 * - Difunde a nodos cercanos adyacentes incrementando 'hop_count'.
 * - Deduplica paquetes usando un registro de 'seenMessageIds' para supresión de ecos.
 * - Respeta un TTL máximo de 5 saltos (Time-To-Live).
 * - Sincronización dual: difusión en malla local P2P + transmisión al servidor central cuando hay conexión.
 * - Soporta eventos SOS y cancelación ('CANCEL_SOS') para apagar alertas cuando el vecino está a salvo.
 *
 * ==============================================================================
 * GUÍA DE INTEGRACIÓN NATIVA / LIBRERÍAS DE MALLA REALES:
 * ==============================================================
 * 1. Capacitor / Cordova:
 *    - Utilizar `@capacitor-community/bluetooth-le` o `cordova-plugin-wifidirect`.
 *    - Conectar `broadcastSos()` a la función `BleClient.startAdvertising()` para emitir
 *      la carga útil en el Service Data (UUID 0xFD6F o similar).
 * 2. React Native:
 *    - Integrar `react-native-nearby-messages` (Google Nearby Connections) para
 *      descubrimiento y transporte sin internet entre Android e iOS.
 *    - Alternativamente, `react-native-multipeer` para Apple Multipeer Connectivity
 *      y `react-native-wifi-p2p` para Android Wi-Fi Direct.
 * 3. Web & WebRTC / Libp2p:
 *    - En entornos de navegador compatibles con WebRTC DataChannels o libp2p (`@libp2p/webrtc`),
 *      reemplazar el loop de simulación local por `node.services.pubsub.publish(topic, bytes)`.
 * ==============================================================================
 */

export interface MeshMessage {
  id: string;
  type: 'SOS_ALERT' | 'CANCEL_SOS' | 'HEARTBEAT';
  timestamp: string;
  senderId: string;
  coords: {
    lat: number;
    lng: number;
  };
  hop_count: number;
  max_hops: number;
  ttl: number; // Contador de saltos restante (TTL hasta 50 saltos)
  status: 'BROADCASTING' | 'RELAYED' | 'DELIVERED' | 'CANCELLED';
  payload: {
    title: string;
    details?: string;
    urgency: 'CRITICA';
  };
}

export interface MeshPeer {
  id: string;
  name: string;
  rssi: number; // Fuerza de señal dBm
  lastSeen: number;
}

export type MeshMessageListener = (msg: MeshMessage) => void;

class MeshService {
  private seenMessageIds = new Set<string>();
  private activeSosMessage: MeshMessage | null = null;
  private listeners: Set<MeshMessageListener> = new Set();
  private storeAndForwardQueue: MeshMessage[] = []; // Almacenamiento y reenvío cuando aparezca un nuevo vecino cercano
  private simulatedPeers: MeshPeer[] = [
    { id: 'peer-nodo-tambo-1', name: 'Nodo Vecino 1 (Jr. Sucre)', rssi: -65, lastSeen: Date.now() },
    { id: 'peer-nodo-tambo-2', name: 'Nodo Brigada Sector 4', rssi: -72, lastSeen: Date.now() },
    { id: 'peer-nodo-tambo-3', name: 'Nodo Municipal Serenazgo', rssi: -80, lastSeen: Date.now() },
  ];

  constructor() {
    // Almacenamiento y reenvío: cargar mensajes pendientes guardados localmente
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('redvecina_mesh_store_forward');
        if (stored) {
          this.storeAndForwardQueue = JSON.parse(stored);
        }
      } catch {}
    }
  }

  public subscribe(listener: MeshMessageListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(msg: MeshMessage): void {
    this.listeners.forEach((listener) => {
      try {
        listener(msg);
      } catch (e) {
        console.error('Error en listener de malla P2P:', e);
      }
    });
  }

  /**
   * Genera un identificador único para el mensaje para evitar duplicados y bucles.
   */
  private generateUuid(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'sos-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
  }

  /**
   * Emite una alerta SOS inmediata a través de la malla vecinal P2P (hasta 50 saltos).
   */
  public async broadcastSos(coords: { lat: number; lng: number }): Promise<MeshMessage> {
    const msgId = this.generateUuid();
    this.seenMessageIds.add(msgId);

    const sosMessage: MeshMessage = {
      id: msgId,
      type: 'SOS_ALERT',
      timestamp: new Date().toISOString(),
      senderId: 'vecino-local-device',
      coords,
      hop_count: 1,
      max_hops: 50, // Punto 9: TTL de hasta 50 saltos
      ttl: 50,
      status: 'BROADCASTING',
      payload: {
        title: 'Alerta SOS de Emergencia Inmediata',
        details: 'El vecino ha emitido un SOS directo desde la cabecera comunitaria.',
        urgency: 'CRITICA',
      },
    };

    this.activeSosMessage = sosMessage;
    this.persistToStoreAndForward(sosMessage);
    this.notify(sosMessage);

    // Sincronización dual con el servidor si hay conexión disponible
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        void fetch('/api/v1/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_mutation_id: msgId,
            author_id: 1,
            sector_id: 1,
            title: 'ALERTA SOS - Emergencia Inmediata en Barrio',
            description: 'Alerta generada con botón de 1 toque y propagada por malla P2P.',
            post_type: 'SOS_VULNERABLE',
            urgency_level: 'CRITICA',
            public_lat: coords.lat,
            public_lng: coords.lng,
            privacy_radius_meters: 50,
            status: 'ACTIVO',
          }),
        }).catch(() => {
          // Si falla, el almacenamiento local Outbox de Dexie.js lo reintenta
        });
      } catch {
        // Red no disponible, se mantiene transmisión 100% P2P local
      }
    }

    return sosMessage;
  }

  /**
   * Reenvía un mensaje en la malla respetando TTL y deduplicación por ID único (Punto 9).
   */
  public relayMessage(incoming: MeshMessage): boolean {
    if (this.seenMessageIds.has(incoming.id)) {
      return false; // Duplicado o bucle: no reenviar
    }

    if (incoming.ttl <= 1 || incoming.hop_count >= 50) {
      return false; // TTL llegó a 0 o límite alcanzado: descartar
    }

    this.seenMessageIds.add(incoming.id);

    const relayed: MeshMessage = {
      ...incoming,
      hop_count: incoming.hop_count + 1,
      ttl: incoming.ttl - 1,
      status: 'RELAYED',
    };

    this.persistToStoreAndForward(relayed);
    this.notify(relayed);
    return true;
  }

  /**
   * Guarda en cola de almacenamiento y reenvío cuando aparezca un nuevo vecino cercano.
   */
  private persistToStoreAndForward(msg: MeshMessage) {
    if (!this.storeAndForwardQueue.some((m) => m.id === msg.id)) {
      this.storeAndForwardQueue.push(msg);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            'redvecina_mesh_store_forward',
            JSON.stringify(this.storeAndForwardQueue.slice(-20))
          );
        } catch {}
      }
    }
  }

  /**
   * Dispara el reenvío de mensajes en cola cuando se detectan nuevos pares cercanos.
   */
  public onNewPeerDiscovered(_peer?: MeshPeer) {
    const pending = [...this.storeAndForwardQueue];
    for (const msg of pending) {
      if (msg.ttl > 0 && msg.type !== 'CANCEL_SOS') {
        this.notify({
          ...msg,
          status: 'RELAYED',
          hop_count: msg.hop_count + 1,
          ttl: msg.ttl - 1,
        });
      }
    }
  }

  /**
   * Cancela la alerta SOS activa enviando un paquete CANCEL_SOS a todos los nodos.
   */
  public async cancelSos(): Promise<MeshMessage | null> {
    if (!this.activeSosMessage) return null;

    const cancelMsg: MeshMessage = {
      ...this.activeSosMessage,
      type: 'CANCEL_SOS',
      timestamp: new Date().toISOString(),
      status: 'CANCELLED',
      hop_count: this.activeSosMessage.hop_count + 1,
      ttl: Math.max(0, this.activeSosMessage.ttl - 1),
    };

    this.seenMessageIds.add(cancelMsg.id);
    this.activeSosMessage = null;
    this.storeAndForwardQueue = this.storeAndForwardQueue.filter((m) => m.id !== cancelMsg.id);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          'redvecina_mesh_store_forward',
          JSON.stringify(this.storeAndForwardQueue)
        );
      } catch {}
    }
    this.notify(cancelMsg);

    return cancelMsg;
  }

  /**
   * Obtiene la alerta activa si existe
   */
  public getActiveSos(): MeshMessage | null {
    return this.activeSosMessage;
  }

  /**
   * Lista de nodos vecinos en la malla local
   */
  public getNearbyPeers(): MeshPeer[] {
    return [...this.simulatedPeers];
  }
}

export const meshService = new MeshService();
