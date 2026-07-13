import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

export interface PaystackVerification {
  /** Paystack transaction status, e.g. "success", "failed", "abandoned" */
  status: string;
  /** Amount actually paid, in the currency's minor unit (kobo for NGN) */
  amount: number;
  currency: string;
  reference: string;
  /** Email the transaction was charged to */
  customerEmail?: string;
}

export interface PaystackBank {
  name: string;
  code: string;
}

export interface ResolvedAccount {
  accountNumber: string;
  accountName: string;
}

export interface TransferResult {
  /** "success", "pending", "otp", "failed", … */
  status: string;
  transferCode: string;
  reference: string;
}

@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly secretKey = process.env.PAYSTACK_SECRET_KEY;
  private readonly baseUrl = 'https://api.paystack.co';

  private ensureConfig() {
    if (!this.secretKey) {
      this.logger.error(
        'PAYSTACK_SECRET_KEY is missing. Set it in .env to enable payment verification.',
      );
      throw new InternalServerErrorException(
        'Payment verification is not configured',
      );
    }
  }

  /**
   * Verifies a transaction with Paystack by reference. Returns the verified
   * transaction details straight from Paystack — never trust client-supplied
   * amounts; always compare against what this returns.
   *
   * @throws InternalServerErrorException if Paystack is unreachable/misconfigured.
   */
  async verifyTransaction(reference: string): Promise<PaystackVerification> {
    this.ensureConfig();

    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/transaction/verify/${encodeURIComponent(reference)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (err) {
      this.logger.error(
        `Failed to reach Paystack for reference ${reference}`,
        err as Error,
      );
      throw new InternalServerErrorException(
        'Could not reach payment provider to verify transaction',
      );
    }

    const body = (await response.json().catch(() => null)) as {
      status?: boolean;
      message?: string;
      data?: {
        status?: string;
        amount?: number;
        currency?: string;
        reference?: string;
        customer?: { email?: string };
      };
    } | null;

    if (!response.ok || !body?.status || !body.data) {
      this.logger.warn(
        `Paystack verification failed for ${reference}: ${
          body?.message ?? response.statusText
        }`,
      );
      throw new InternalServerErrorException(
        'Could not verify transaction with payment provider',
      );
    }

    return {
      status: body.data.status ?? 'unknown',
      amount: body.data.amount ?? 0,
      currency: body.data.currency ?? '',
      reference: body.data.reference ?? reference,
      customerEmail: body.data.customer?.email,
    };
  }

  // ---------- Transfers (tutor payout disbursement) ----------

  /** Transfers use the same secret key as verification. */
  transfersConfigured(): boolean {
    return !!this.secretKey;
  }

  /** Authenticated GET/POST helper against the Paystack API. */
  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<{ ok: boolean; status?: boolean; message?: string; data?: T }> {
    this.ensureConfig();
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      this.logger.error(`Failed to reach Paystack ${path}`, err as Error);
      throw new InternalServerErrorException('Could not reach payment provider');
    }
    const json = (await res.json().catch(() => null)) as {
      status?: boolean;
      message?: string;
      data?: T;
    } | null;
    return {
      ok: res.ok,
      status: json?.status,
      message: json?.message,
      data: json?.data,
    };
  }

  /** Lists Nigerian banks (name + Paystack bank code) for a bank picker. */
  async listBanks(): Promise<PaystackBank[]> {
    const res = await this.request<Array<{ name: string; code: string }>>(
      'GET',
      '/bank?currency=NGN',
    );
    if (!res.status || !res.data) return [];
    return res.data.map((b) => ({ name: b.name, code: b.code }));
  }

  /**
   * Resolves an account number + bank code to the holder's name, so we never
   * create a recipient for an account that doesn't exist. Returns null if the
   * account can't be resolved.
   */
  async resolveAccount(
    accountNumber: string,
    bankCode: string,
  ): Promise<ResolvedAccount | null> {
    const res = await this.request<{
      account_number?: string;
      account_name?: string;
    }>(
      'GET',
      `/bank/resolve?account_number=${encodeURIComponent(
        accountNumber,
      )}&bank_code=${encodeURIComponent(bankCode)}`,
    );
    if (!res.status || !res.data?.account_name) return null;
    return {
      accountNumber: res.data.account_number ?? accountNumber,
      accountName: res.data.account_name,
    };
  }

  /** Creates a Paystack transfer recipient; returns its recipient_code. */
  async createTransferRecipient(params: {
    name: string;
    accountNumber: string;
    bankCode: string;
  }): Promise<string> {
    const res = await this.request<{ recipient_code?: string }>(
      'POST',
      '/transferrecipient',
      {
        type: 'nuban',
        name: params.name,
        account_number: params.accountNumber,
        bank_code: params.bankCode,
        currency: 'NGN',
      },
    );
    if (!res.status || !res.data?.recipient_code) {
      throw new InternalServerErrorException(
        res.message || 'Could not create transfer recipient',
      );
    }
    return res.data.recipient_code;
  }

  /**
   * Initiates a transfer of `amountNaira` to a recipient. `reference` is our
   * idempotency key. Returns the transfer status/code/reference.
   */
  async initiateTransfer(params: {
    amountNaira: number;
    recipientCode: string;
    reference: string;
    reason?: string;
  }): Promise<TransferResult> {
    const res = await this.request<{
      status?: string;
      transfer_code?: string;
      reference?: string;
    }>('POST', '/transfer', {
      source: 'balance',
      amount: Math.round(params.amountNaira * 100), // kobo
      recipient: params.recipientCode,
      reference: params.reference,
      reason: params.reason,
    });
    if (!res.status || !res.data) {
      throw new InternalServerErrorException(
        res.message || 'Transfer could not be initiated',
      );
    }
    return {
      status: res.data.status ?? 'unknown',
      transferCode: res.data.transfer_code ?? '',
      reference: res.data.reference ?? params.reference,
    };
  }

  /**
   * Verifies a Paystack webhook signature (HMAC-SHA512 of the raw body with the
   * secret key), constant-time compared against the x-paystack-signature header.
   */
  verifyWebhookSignature(rawBody: Buffer, signature?: string): boolean {
    if (!this.secretKey || !signature) return false;
    const expected = createHmac('sha512', this.secretKey)
      .update(rawBody)
      .digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
