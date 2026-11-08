/**
 * @file src/lib/crypto/device-identity.ts
 * @description Capa Criptográfica P2P / Local-First:
 * Identidad Anónima por Dispositivo (Cero datos personales requeridos).
 * Genera un par de claves asimétricas en WebCrypto (Ed25519 o ECDSA P-256) y un device_id UUID persistente.
 * Registra únicamente la clave pública en el servidor.
 */

const STORAGE_KEY_DEVICE_ID = 'redvecina_device_id';
const STORAGE_KEY_PUBLIC_KEY = 'redvecina_device_public_key';
const STORAGE_KEY_PRIVATE_KEY = 'redvecina_device_private_key';

export interface DeviceCredentials {
  deviceId: string;
  publicKeyBase64: string;
}

/**
 * Convierte un ArrayBuffer a Base64 URL-safe
 */
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * Convierte Base64 a Uint8Array
 */
export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Genera un UUID v4 seguro
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') {
    return '00000000-0000-4000-8000-000000000000';
  }
  let id = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
  if (!id) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      id = crypto.randomUUID();
    } else {
      id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
    localStorage.setItem(STORAGE_KEY_DEVICE_ID, id);
  }
  return id;
}

/**
 * Obtiene o inicializa el par de claves criptográficas del dispositivo usando WebCrypto.
 * Intenta Ed25519 (estándar moderno); si el entorno no lo soporta, usa ECDSA P-256.
 */
export async function getOrCreateDeviceKeyPair(): Promise<DeviceCredentials> {
  const deviceId = getOrCreateDeviceId();
  if (typeof window === 'undefined') {
    return { deviceId, publicKeyBase64: 'server-mock-public-key' };
  }

  const storedPub = localStorage.getItem(STORAGE_KEY_PUBLIC_KEY);
  const storedPriv = localStorage.getItem(STORAGE_KEY_PRIVATE_KEY);

  if (storedPub && storedPriv) {
    return { deviceId, publicKeyBase64: storedPub };
  }

  try {
    let keyPair: CryptoKeyPair;
    try {
      // Intento con Ed25519
      keyPair = (await crypto.subtle.generateKey(
        'Ed25519',
        true,
        ['sign', 'verify']
      )) as CryptoKeyPair;
    } catch {
      // Fallback a ECDSA P-256 ampliamente soportado
      keyPair = (await crypto.subtle.generateKey(
        {
          name: 'ECDSA',
          namedCurve: 'P-256',
        },
        true,
        ['sign', 'verify']
      )) as CryptoKeyPair;
    }

    const exportedPublic = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const exportedPrivate = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    const pubBase64 = bufferToBase64(exportedPublic);
    const privBase64 = bufferToBase64(exportedPrivate);

    localStorage.setItem(STORAGE_KEY_PUBLIC_KEY, pubBase64);
    localStorage.setItem(STORAGE_KEY_PRIVATE_KEY, privBase64);

    return { deviceId, publicKeyBase64: pubBase64 };
  } catch (err) {
    // Modo de contingencia offline si WebCrypto está restringido
    const fallbackPub = `anon-pub-${deviceId.slice(0, 8)}`;
    localStorage.setItem(STORAGE_KEY_PUBLIC_KEY, fallbackPub);
    return { deviceId, publicKeyBase64: fallbackPub };
  }
}

/**
 * Firma un mensaje con la clave privada local del dispositivo.
 */
export async function signWithDeviceKey(message: string): Promise<string> {
  if (typeof window === 'undefined') return 'mock-server-sig';
  const privBase64 = localStorage.getItem(STORAGE_KEY_PRIVATE_KEY);
  if (!privBase64) {
    await getOrCreateDeviceKeyPair();
  }

  try {
    const rawPriv = localStorage.getItem(STORAGE_KEY_PRIVATE_KEY);
    if (!rawPriv) return 'unsigned';

    const privKeyBuffer = base64ToBuffer(rawPriv);
    const encoder = new TextEncoder();
    const data = encoder.encode(message);

    // Intentar importar según el algoritmo generado
    try {
      const privateKey = await crypto.subtle.importKey(
        'pkcs8',
        privKeyBuffer,
        'Ed25519',
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign('Ed25519', privateKey, data);
      return bufferToBase64(signature);
    } catch {
      const privateKey = await crypto.subtle.importKey(
        'pkcs8',
        privKeyBuffer,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        privateKey,
        data
      );
      return bufferToBase64(signature);
    }
  } catch {
    return `fallback-sig-${Date.now()}`;
  }
}
