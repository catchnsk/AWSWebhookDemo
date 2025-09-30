import * as crypto from 'crypto';

/**
 * Generate webhook secret for HMAC signature
 */
export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Generate HMAC signature for webhook payload
 */
export function generateWebhookSignature(
  payload: any,
  secret: string,
  timestamp: number
): string {
  const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return `t=${timestamp},v1=${signature}`;
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: any,
  signatureHeader: string,
  secret: string,
  toleranceSeconds: number = 300 // 5 minutes
): { valid: boolean; error?: string } {
  try {
    // Parse signature header
    const parts = signatureHeader.split(',');
    const timestampPart = parts.find((p) => p.startsWith('t='));
    const signaturePart = parts.find((p) => p.startsWith('v1='));

    if (!timestampPart || !signaturePart) {
      return { valid: false, error: 'Invalid signature format' };
    }

    const timestamp = parseInt(timestampPart.split('=')[1], 10);
    const signature = signaturePart.split('=')[1];

    // Check timestamp tolerance
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSeconds) {
      return { valid: false, error: 'Signature timestamp is outside tolerance window' };
    }

    // Verify signature
    const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    const valid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    return { valid };
  } catch (error: any) {
    return { valid: false, error: `Signature verification failed: ${error.message}` };
  }
}

/**
 * Encrypt sensitive data (for storing auth credentials)
 */
export function encrypt(text: string, encryptionKey?: string): string {
  const key = encryptionKey || process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('Encryption key not configured');
  }

  // Use AES-256-GCM
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    Buffer.from(key, 'hex'),
    iv
  );

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Return IV + AuthTag + Encrypted data
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedText: string, encryptionKey?: string): string {
  const key = encryptionKey || process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('Encryption key not configured');
  }

  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(key, 'hex'),
    iv
  );

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate API key
 */
export function generateApiKey(prefix: string = 'wh_live'): string {
  return `${prefix}_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Hash API key for storage
 */
export function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Generate execution ID
 */
export function generateExecutionId(): string {
  return `exec_${crypto.randomBytes(16).toString('hex')}`;
}