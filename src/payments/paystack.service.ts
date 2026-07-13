import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

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
}
