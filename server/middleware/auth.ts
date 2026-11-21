import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type express from 'express';

export interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  isAdmin: boolean;
}

export interface AuthenticatedRequest extends express.Request {
  authUser?: VerifiedFirebaseUser;
}

interface CertCacheState {
  certs: Record<string, string>;
  expiresAtMs: number;
  lastFetchedAtMs: number;
}

export interface TokenVerifyOptions {
  projectId?: string;
  nowSeconds?: number;
  certsOverride?: Record<string, string>;
}

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const MIN_CACHE_TTL_MS = 60_000;
const MAX_CACHE_TTL_MS = 3_600_000;
const CERT_FETCH_TIMEOUT_MS = 8_000;

let cachedProjectId: string | null = null;
let certCache: CertCacheState = {
  certs: {},
  expiresAtMs: 0,
  lastFetchedAtMs: 0,
};
let inFlightCertFetch: Promise<Record<string, string>> | null = null;

export class AuthVerificationError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = 'AuthVerificationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function getFirebaseProjectId(): string {
  if (cachedProjectId) return cachedProjectId;

  const envId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (envId) {
    cachedProjectId = envId;
    return cachedProjectId;
  }

  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as { projectId?: string };
    if (parsed.projectId && typeof parsed.projectId === 'string') {
      cachedProjectId = parsed.projectId.trim();
      return cachedProjectId;
    }
  } catch {
    // Fall through to error
  }

  throw new AuthVerificationError(
    'Server authentication configuration is incomplete.',
    500,
    'AUTH_CONFIG_ERROR'
  );
}

export function getAdminOwnerEmail(): string {
  return (process.env.ADMIN_OWNER_EMAIL || 'sharmifrancis123@gmail.com')
    .trim()
    .toLowerCase();
}

function decodeBase64UrlToBuffer(segment: string): Buffer {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  return Buffer.from(normalized + '='.repeat(padding), 'base64');
}

function parseMaxAgeMs(cacheControlHeader: string | null): number {
  if (!cacheControlHeader) return 300_000;
  const match = cacheControlHeader.match(/max-age=(\d+)/i);
  if (!match) return 300_000;
  const seconds = Number.parseInt(match[1], 10);
  if (!Number.isFinite(seconds) || seconds <= 0) return MIN_CACHE_TTL_MS;
  return Math.max(MIN_CACHE_TTL_MS, Math.min(MAX_CACHE_TTL_MS, seconds * 1000));
}

async function fetchGooglePublicCerts(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && Object.keys(certCache.certs).length > 0 && now < certCache.expiresAtMs) {
    return certCache.certs;
  }

  if (
    forceRefresh &&
    Object.keys(certCache.certs).length > 0 &&
    now - certCache.lastFetchedAtMs < 30_000
  ) {
    return certCache.certs;
  }

  if (inFlightCertFetch) {
    return inFlightCertFetch;
  }

  inFlightCertFetch = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CERT_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(GOOGLE_CERTS_URL, {
        method: 'GET',
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Cert fetch returned ${res.status}`);
      }
      const certs = (await res.json()) as Record<string, string>;
      if (!certs || typeof certs !== 'object' || Object.keys(certs).length === 0) {
        throw new Error('Empty certificate set');
      }
      const ttlMs = parseMaxAgeMs(res.headers.get('cache-control'));
      certCache = {
        certs,
        expiresAtMs: Date.now() + ttlMs,
        lastFetchedAtMs: Date.now(),
      };
      return certs;
    } catch (err) {
      if (Object.keys(certCache.certs).length > 0) {
        return certCache.certs;
      }
      throw new AuthVerificationError(
        'Unable to verify authentication credentials right now. Please try again.',
        503,
        'AUTH_CERTS_UNAVAILABLE'
      );
    } finally {
      clearTimeout(timeout);
      inFlightCertFetch = null;
    }
  })();

  return inFlightCertFetch;
}

/**
 * Verifies a Firebase Authentication ID token cryptographically (RS256)
 * without requiring privileged Firebase Admin IAM service-account credentials.
 */
export async function verifyFirebaseIdToken(
  token: string,
  options?: TokenVerifyOptions
): Promise<VerifiedFirebaseUser> {
  if (!token || typeof token !== 'string' || token.length > 16_384) {
    throw new AuthVerificationError(
      'Authentication token is missing or malformed.',
      401,
      'INVALID_TOKEN'
    );
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new AuthVerificationError(
      'Authentication token structure is invalid.',
      401,
      'INVALID_TOKEN'
    );
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new AuthVerificationError(
      'Authentication token is incomplete.',
      401,
      'INVALID_TOKEN'
    );
  }

  let header: { alg?: unknown; kid?: unknown };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(decodeBase64UrlToBuffer(encodedHeader).toString('utf8')) as {
      alg?: unknown;
      kid?: unknown;
    };
    payload = JSON.parse(decodeBase64UrlToBuffer(encodedPayload).toString('utf8')) as Record<
      string,
      unknown
    >;
  } catch {
    throw new AuthVerificationError(
      'Authentication token could not be decoded.',
      401,
      'INVALID_TOKEN'
    );
  }

  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid.trim()) {
    throw new AuthVerificationError(
      'Authentication token signing algorithm is not accepted.',
      401,
      'INVALID_TOKEN'
    );
  }

  let certs = options?.certsOverride
    ? options.certsOverride
    : await fetchGooglePublicCerts(false);
  let pemCert = certs[header.kid];

  if (!pemCert && !options?.certsOverride) {
    certs = await fetchGooglePublicCerts(true);
    pemCert = certs[header.kid];
  }

  if (!pemCert || typeof pemCert !== 'string') {
    throw new AuthVerificationError(
      'Authentication token key identifier is unrecognized.',
      401,
      'INVALID_TOKEN'
    );
  }

  let signatureValid = false;
  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${encodedHeader}.${encodedPayload}`);
    verifier.end();
    signatureValid = verifier.verify(pemCert, decodeBase64UrlToBuffer(encodedSignature));
  } catch {
    signatureValid = false;
  }

  if (!signatureValid) {
    throw new AuthVerificationError(
      'Authentication token signature check failed.',
      401,
      'INVALID_TOKEN'
    );
  }

  const projectId = options?.projectId || getFirebaseProjectId();
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  const nowSeconds = options?.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (payload.iss !== expectedIssuer) {
    throw new AuthVerificationError('Authentication token issuer is invalid.', 401, 'INVALID_TOKEN');
  }

  if (payload.aud !== projectId) {
    throw new AuthVerificationError(
      'Authentication token audience is invalid.',
      401,
      'INVALID_TOKEN'
    );
  }

  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) {
    throw new AuthVerificationError(
      'Your session has expired. Please refresh or sign in again.',
      401,
      'TOKEN_EXPIRED'
    );
  }

  if (typeof payload.iat !== 'number' || payload.iat > nowSeconds + 300) {
    throw new AuthVerificationError(
      'Authentication token issued-at timestamp is invalid.',
      401,
      'INVALID_TOKEN'
    );
  }

  if (
    typeof payload.auth_time !== 'number' ||
    payload.auth_time > nowSeconds + 300
  ) {
    throw new AuthVerificationError(
      'Authentication token auth_time claim is invalid.',
      401,
      'INVALID_TOKEN'
    );
  }

  const uid = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  if (!uid || uid.length > 128) {
    throw new AuthVerificationError(
      'Authentication token subject is missing.',
      401,
      'INVALID_TOKEN'
    );
  }

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const emailVerified = payload.email_verified === true;
  if (!email || !emailVerified) {
    throw new AuthVerificationError(
      'A verified Google email account is required to access SmartEd AI features.',
      403,
      'EMAIL_NOT_VERIFIED'
    );
  }

  const name = typeof payload.name === 'string' ? payload.name.trim().slice(0, 120) : undefined;
  const isAdmin = email === getAdminOwnerEmail();

  return {
    uid,
    email,
    emailVerified,
    name,
    isAdmin,
  };
}

export function extractBearerToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return null;
  return match[1].trim();
}

export async function requireFirebaseAuth(
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
): Promise<void> {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({
      error: 'Please sign in with Google to access SmartEd AI features.',
      code: 'AUTH_REQUIRED',
    });
    return;
  }

  try {
    const user = await verifyFirebaseIdToken(token);
    req.authUser = user;
    next();
  } catch (err) {
    if (err instanceof AuthVerificationError) {
      res.status(err.statusCode).json({
        error: err.message,
        code: err.code,
      });
      return;
    }
    res.status(401).json({
      error: 'Authentication failed. Please sign in again.',
      code: 'AUTH_FAILED',
    });
  }
}
