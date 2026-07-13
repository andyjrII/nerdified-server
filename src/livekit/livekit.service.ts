import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  AccessToken,
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  S3Upload,
  VideoGrant,
} from 'livekit-server-sdk';

@Injectable()
export class LivekitService {
  private readonly logger = new Logger(LivekitService.name);
  private readonly apiKey = process.env.LIVEKIT_API_KEY;
  private readonly apiSecret = process.env.LIVEKIT_API_SECRET;
  private readonly wsUrl = process.env.LIVEKIT_WS_URL;
  // Recording (egress) output — S3-compatible storage (AWS S3, R2, B2, MinIO…)
  private readonly s3KeyId = process.env.RECORDING_S3_KEY_ID;
  private readonly s3Secret = process.env.RECORDING_S3_SECRET;
  private readonly s3Bucket = process.env.RECORDING_S3_BUCKET;
  private readonly s3Region = process.env.RECORDING_S3_REGION;
  private readonly s3Endpoint = process.env.RECORDING_S3_ENDPOINT;

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

  // ---------- Session recording (room composite egress) ----------

  /** Recording needs LiveKit itself plus S3-compatible storage for the file. */
  recordingConfigured(): boolean {
    return !!(
      this.apiKey &&
      this.apiSecret &&
      this.wsUrl &&
      this.s3KeyId &&
      this.s3Secret &&
      this.s3Bucket
    );
  }

  private egressClient(): EgressClient {
    this.ensureConfig();
    const host = (this.wsUrl as string).replace(/^ws/, 'http');
    return new EgressClient(host, this.apiKey, this.apiSecret);
  }

  /** Starts recording a room to S3-compatible storage. Returns the egress id. */
  async startRoomRecording(
    roomName: string,
    filepath: string,
  ): Promise<string> {
    const output = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath,
      output: {
        case: 's3',
        value: new S3Upload({
          accessKey: this.s3KeyId as string,
          secret: this.s3Secret as string,
          bucket: this.s3Bucket as string,
          region: this.s3Region ?? '',
          endpoint: this.s3Endpoint ?? '',
          forcePathStyle: !!this.s3Endpoint,
        }),
      },
    });
    const info = await this.egressClient().startRoomCompositeEgress(roomName, {
      file: output,
    });
    this.logger.log(
      `Started recording room ${roomName} (egress ${info.egressId})`,
    );
    return info.egressId;
  }

  /**
   * Stops a recording and returns the file's public URL:
   * RECORDING_PUBLIC_BASE_URL/<filepath> when set, otherwise the storage
   * location reported by the egress.
   */
  async stopRoomRecording(egressId: string): Promise<string | null> {
    const info = await this.egressClient().stopEgress(egressId);
    const file = info.fileResults?.[0];
    if (!file) return null;
    const base = process.env.RECORDING_PUBLIC_BASE_URL?.replace(/\/$/, '');
    if (base && file.filename) return `${base}/${file.filename}`;
    return file.location || null;
  }
}

