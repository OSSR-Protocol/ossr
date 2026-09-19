import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export type NonceReservationStatus = 'SIGNED' | 'SIMULATED' | 'BROADCAST' | 'AMBIGUOUS' | 'CONFIRMED' | 'FAILED';

export type NonceReservation = {
  sponsor: string;
  nonce: string;
  txid: string;
  status: NonceReservationStatus;
  createdAt: string;
  updatedAt: string;
  chainStatus?: string;
  failureReason?: string;
};

export interface NonceStore {
  nextNonce(sponsor: string, chainNonce: bigint): Promise<bigint>;
  reserve(sponsor: string, nonce: bigint, txid: string, status: 'SIGNED' | 'SIMULATED'): Promise<NonceReservation>;
  update(sponsor: string, txid: string, update: Partial<Pick<NonceReservation, 'status' | 'chainStatus' | 'failureReason'>>): Promise<NonceReservation>;
  list(sponsor: string): Promise<NonceReservation[]>;
}

export class MemoryNonceStore implements NonceStore {
  protected reservations: NonceReservation[] = [];
  private queue: Promise<void> = Promise.resolve();

  async nextNonce(sponsor: string, chainNonce: bigint): Promise<bigint> {
    const reservedNext = (await this.list(sponsor)).reduce((next, record) => {
      const candidate = BigInt(record.nonce) + 1n;
      return candidate > next ? candidate : next;
    }, 0n);
    return reservedNext > chainNonce ? reservedNext : chainNonce;
  }
  async reserve(sponsor: string, nonce: bigint, txid: string, status: 'SIGNED' | 'SIMULATED'): Promise<NonceReservation> {
    return this.exclusive(async () => {
      if (this.reservations.some(record => record.sponsor === sponsor && record.nonce === nonce.toString())) throw new Error(`Sponsor nonce ${nonce} is already reserved.`);
      if (this.reservations.some(record => record.sponsor === sponsor && record.txid === txid)) throw new Error(`Transaction ${txid} already has a nonce reservation.`);
      const timestamp = new Date().toISOString();
      const record = normalize({ sponsor, nonce: nonce.toString(), txid, status, createdAt: timestamp, updatedAt: timestamp });
      this.reservations.push(record);
      await this.persist();
      return { ...record };
    });
  }
  async update(sponsor: string, txid: string, update: Partial<Pick<NonceReservation, 'status' | 'chainStatus' | 'failureReason'>>): Promise<NonceReservation> {
    return this.exclusive(async () => {
      const index = this.reservations.findIndex(record => record.sponsor === sponsor && record.txid === txid);
      if (index < 0) throw new Error(`Nonce reservation for ${txid} was not found.`);
      const record = normalize({ ...this.reservations[index], ...update, updatedAt: new Date().toISOString() });
      this.reservations[index] = record;
      await this.persist();
      return { ...record };
    });
  }
  async list(sponsor: string): Promise<NonceReservation[]> {
    return this.reservations.filter(record => record.sponsor === sponsor).map(record => ({ ...record })).sort((a, b) => Number(BigInt(a.nonce) - BigInt(b.nonce)));
  }
  protected async persist(): Promise<void> {}
  protected async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise(resolve => { release = resolve; });
    await previous;
    try { return await operation(); } finally { release(); }
  }
}

export class JsonNonceStore extends MemoryNonceStore {
  private loaded = false;
  constructor(private readonly path: string) { super(); }

  override async nextNonce(sponsor: string, chainNonce: bigint): Promise<bigint> { await this.load(); return super.nextNonce(sponsor, chainNonce); }
  override async reserve(sponsor: string, nonce: bigint, txid: string, status: 'SIGNED' | 'SIMULATED'): Promise<NonceReservation> { await this.load(); return super.reserve(sponsor, nonce, txid, status); }
  override async update(sponsor: string, txid: string, update: Partial<Pick<NonceReservation, 'status' | 'chainStatus' | 'failureReason'>>): Promise<NonceReservation> { await this.load(); return super.update(sponsor, txid, update); }
  override async list(sponsor: string): Promise<NonceReservation[]> { await this.load(); return super.list(sponsor); }

  protected override async persist(): Promise<void> {
    if (!this.loaded) return;
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify(this.reservations, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.path);
  }
  private async load(): Promise<void> {
    if (this.loaded) return;
    await this.exclusive(async () => {
      if (this.loaded) return;
      try {
        const parsed: unknown = JSON.parse(await readFile(this.path, 'utf8'));
        if (!Array.isArray(parsed)) throw new Error('Nonce store must contain an array.');
        this.reservations = parsed.map(normalize);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      this.loaded = true;
    });
  }
}

function normalize(value: unknown): NonceReservation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Nonce reservation must be an object.');
  const record = value as NonceReservation;
  if (typeof record.sponsor !== 'string' || !/^S[PTMN][A-Z0-9]+$/.test(record.sponsor)) throw new Error('Nonce reservation sponsor is invalid.');
  if (typeof record.nonce !== 'string' || !/^\d+$/.test(record.nonce)) throw new Error('Nonce reservation nonce is invalid.');
  if (typeof record.txid !== 'string' || !/^[0-9a-f]{64}$/i.test(record.txid)) throw new Error('Nonce reservation txid is invalid.');
  if (!['SIGNED', 'SIMULATED', 'BROADCAST', 'AMBIGUOUS', 'CONFIRMED', 'FAILED'].includes(record.status)) throw new Error('Nonce reservation status is invalid.');
  if (!Number.isFinite(Date.parse(record.createdAt)) || !Number.isFinite(Date.parse(record.updatedAt))) throw new Error('Nonce reservation timestamp is invalid.');
  if (record.chainStatus !== undefined && typeof record.chainStatus !== 'string') throw new Error('Nonce reservation chain status is invalid.');
  if (record.failureReason !== undefined && typeof record.failureReason !== 'string') throw new Error('Nonce reservation failure reason is invalid.');
  return { ...record };
}
