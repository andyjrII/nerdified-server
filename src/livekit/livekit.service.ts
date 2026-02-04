import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { AccessToken, VideoGrant } from 'livekit-server-sdk';

@Injectable()
export class LivekitService {
  private readonly logger = new Logger(LivekitService.name);
  private readonly apiKey = process.env.LIVEKIT_API_KEY;
  private readonly apiSecret = process.env.LIVEKIT_API_SECRET;
  private readonly wsUrl = process.env.LIVEKIT_WS_URL;

  private ensureConfig() {
    if (!this.apiKey || !this.apiSecret || !this.wsUrl) {
      this.logger.error(
        'LiveKit environment variables are missing. Please set LIVEKIT_WS_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.',
      );
      throw new InternalServerErrorException(
        'LiveKit configuration is incomplete',
      );
    }
  }

  get websocketUrl(): string {
    this.ensureConfig();
    return this.wsUrl as string;
  }

  async createParticipantToken(options: {
    roomName: string;
    identity: string;
    name?: string;
    metadata?: Record<string, any>;
    isPublisher?: boolean;
    ttlSeconds?: number;
  }): Promise<string> {
    this.ensureConfig();

    const {
      roomName,
      identity,
      name,
      metadata,
      ttlSeconds = 60 * 60, // 1 hour default
    } = options;

    const grant: VideoGrant = {
      roomJoin: true,
      room: roomName,
      canSubscribe: true,
      canPublish: true,
      canPublishData: true,
    };

    const accessToken = new AccessToken(this.apiKey, this.apiSecret, {
      identity,
      name,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    });
    accessToken.ttl = ttlSeconds;
    accessToken.addGrant(grant);

    return await accessToken.toJwt();
  }
}

