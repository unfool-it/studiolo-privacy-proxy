import crypto from 'crypto';

const ALGORITHM: string = 'aes-256-cbc';
const ENCRYPTION_KEY: Buffer = Buffer.from(process.env['ENCRYPTION_KEY'] || '0'.repeat(64), 'hex');
const IV_LENGTH: number = 16;

export function encrypt(text: string): string {
    const iv: Buffer = crypto.randomBytes(IV_LENGTH);
    const cipher: crypto.Cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let encrypted: Buffer = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
    const textParts: string[] = text.split(':');
    const ivStr = textParts.shift();
    if (!ivStr) throw new Error('Invalid encrypted format');
    
    const iv: Buffer = Buffer.from(ivStr, 'hex');
    const encryptedText: Buffer = Buffer.from(textParts.join(':'), 'hex');
    const decipher: crypto.Decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted: Buffer = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}
