import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { cloudinary } from '../cloudinary/cloudinary.provider';

interface CertificateData {
  certificateNo: string;
  studentName: string;
  courseTitle: string;
  tutorName: string;
  completedAt: Date;
}

@Injectable()
export class CertificatesService {
  private readonly logger = new Logger(CertificatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Stable, human-readable certificate number for an enrollment. */
  private certificateNo(enrollmentId: number, completedAt: Date): string {
    const year = completedAt.getUTCFullYear();
    return `NERD-${year}-${String(enrollmentId).padStart(5, '0')}`;
  }

  /** Renders a branded A4-landscape completion certificate to a PDF buffer. */
  private renderPdf(data: CertificateData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const W = doc.page.width;
        const H = doc.page.height;
        const navy = '#1e3a8a';
        const gold = '#b8860b';
        const ink = '#1f2937';

        // Background + double border frame
        doc.rect(0, 0, W, H).fill('#ffffff');
        doc
          .lineWidth(6)
          .strokeColor(navy)
          .rect(24, 24, W - 48, H - 48)
          .stroke();
        doc
          .lineWidth(1.5)
          .strokeColor(gold)
          .rect(36, 36, W - 72, H - 72)
          .stroke();

        // Brand
        doc
          .fillColor(navy)
          .font('Helvetica-Bold')
          .fontSize(26)
          .text('NERDIFIED', 0, 70, { align: 'center' });
        doc
          .fillColor(gold)
          .font('Helvetica')
          .fontSize(11)
          .text('Learn live. Learn better.', { align: 'center' });

        // Title
        doc
          .fillColor(ink)
          .font('Helvetica')
          .fontSize(22)
          .text('Certificate of Completion', 0, 140, { align: 'center' });

        doc
          .fillColor('#6b7280')
          .fontSize(13)
          .text('This certifies that', 0, 188, { align: 'center' });

        // Recipient
        doc
          .fillColor(navy)
          .font('Helvetica-Bold')
          .fontSize(38)
          .text(data.studentName || 'Student', 0, 214, { align: 'center' });

        doc
          .fillColor('#6b7280')
          .font('Helvetica')
          .fontSize(13)
          .text('has successfully completed the course', 0, 272, {
            align: 'center',
          });

        // Course
        doc
          .fillColor(ink)
          .font('Helvetica-Bold')
          .fontSize(22)
          .text(data.courseTitle, 80, 300, {
            align: 'center',
            width: W - 160,
          });

        // Footer row: date (left) / seal (center) / instructor (right)
        const footerY = H - 150;
        const dateStr = data.completedAt.toLocaleDateString('en-GB', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        doc
          .lineWidth(1)
          .strokeColor('#9ca3af')
          .moveTo(90, footerY + 34)
          .lineTo(270, footerY + 34)
          .stroke();
        doc
          .fillColor(ink)
          .font('Helvetica')
          .fontSize(12)
          .text(dateStr, 90, footerY + 40, { width: 180, align: 'center' });
        doc
          .fillColor('#6b7280')
          .fontSize(9)
          .text('DATE', 90, footerY + 58, { width: 180, align: 'center' });

        doc
          .strokeColor('#9ca3af')
          .moveTo(W - 270, footerY + 34)
          .lineTo(W - 90, footerY + 34)
          .stroke();
        doc
          .fillColor(ink)
          .font('Helvetica-Bold')
          .fontSize(12)
          .text(data.tutorName || 'Nerdified', W - 270, footerY + 40, {
            width: 180,
            align: 'center',
          });
        doc
          .fillColor('#6b7280')
          .font('Helvetica')
          .fontSize(9)
          .text('INSTRUCTOR', W - 270, footerY + 58, {
            width: 180,
            align: 'center',
          });

        // Center seal
        const cx = W / 2;
        const cy = footerY + 30;
        doc.lineWidth(3).strokeColor(gold).circle(cx, cy, 34).stroke();
        doc.lineWidth(1).strokeColor(gold).circle(cx, cy, 27).stroke();
        doc
          .fillColor(gold)
          .font('Helvetica-Bold')
          .fontSize(10)
          .text('NERDIFIED', cx - 34, cy - 5, { width: 68, align: 'center' });

        // Certificate number
        doc
          .fillColor('#9ca3af')
          .font('Helvetica')
          .fontSize(9)
          .text(
            `Certificate No: ${data.certificateNo}`,
            0,
            H - 60,
            { align: 'center' },
          );

        doc.end();
      } catch (err) {
        reject(err as Error);
      }
    });
  }

  /** Uploads a PDF buffer to Cloudinary as a raw asset and returns its URL. */
  private uploadPdf(buffer: Buffer, certificateNo: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'nerdified/certificates',
          public_id: certificateNo,
          resource_type: 'raw',
          format: 'pdf',
          overwrite: true,
        },
        (error, result) => {
          if (error || !result) {
            return reject(error ?? new Error('Certificate upload failed'));
          }
          resolve(result.secure_url);
        },
      );
      uploadStream.end(buffer);
    });
  }

  /**
   * Issues the certificate for a FINISHED enrollment. Idempotent: returns the
   * existing URL if already issued. Returns null if not eligible or on error.
   */
  async issueForEnrollment(enrollmentId: number): Promise<string | null> {
    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        student: { select: { id: true, name: true } },
        course: {
          select: { title: true, tutor: { select: { name: true } } },
        },
      },
    });
    if (!enrollment) return null;
    if (enrollment.certificateUrl) return enrollment.certificateUrl;
    if (enrollment.status !== 'FINISHED') return null;

    try {
      const completedAt = enrollment.completedAt ?? new Date();
      const certificateNo = this.certificateNo(enrollment.id, completedAt);
      const pdf = await this.renderPdf({
        certificateNo,
        studentName: enrollment.student.name ?? 'Student',
        courseTitle: enrollment.course.title,
        tutorName: enrollment.course.tutor?.name ?? 'Nerdified',
        completedAt,
      });
      const url = await this.uploadPdf(pdf, certificateNo);

      // Claim: only set the URL if still empty, so we don't double-issue.
      const claimed = await this.prisma.courseEnrollment.updateMany({
        where: { id: enrollment.id, certificateUrl: null },
        data: { certificateUrl: url, completedAt },
      });
      if (claimed.count === 0) {
        const current = await this.prisma.courseEnrollment.findUnique({
          where: { id: enrollment.id },
          select: { certificateUrl: true },
        });
        return current?.certificateUrl ?? url;
      }

      await this.notifications.notifyStudent(enrollment.student.id, {
        type: 'SYSTEM',
        title: 'Certificate ready',
        message: `Your certificate for "${enrollment.course.title}" is ready to download.`,
        link: '/student/courses',
      });
      return url;
    } catch (err) {
      this.logger.error(
        `Failed to issue certificate for enrollment ${enrollmentId}`,
        err as Error,
      );
      return null;
    }
  }

  /** Issues certificates for every FINISHED enrollment of a course (best-effort). */
  async issueForCourse(courseId: number): Promise<void> {
    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: { courseId, status: 'FINISHED', certificateUrl: null },
      select: { id: true },
    });
    for (const e of enrollments) {
      await this.issueForEnrollment(e.id);
    }
  }

  /** Lists the current student's issued certificates. */
  async getMyCertificates(studentId: number) {
    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: {
        studentId,
        status: 'FINISHED',
        certificateUrl: { not: null },
      },
      select: {
        id: true,
        certificateUrl: true,
        completedAt: true,
        course: { select: { id: true, title: true } },
      },
      orderBy: { completedAt: 'desc' },
    });
    return enrollments.map((e) => ({
      enrollmentId: e.id,
      courseId: e.course.id,
      courseTitle: e.course.title,
      certificateUrl: e.certificateUrl,
      completedAt: e.completedAt,
      certificateNo: this.certificateNo(e.id, e.completedAt ?? new Date()),
    }));
  }

  /**
   * Issues (or returns) the certificate for one enrollment on demand, checked
   * against the requesting user. Students may only touch their own; admins any.
   */
  async issueForUser(
    enrollmentId: number,
    userId: number,
    role: string,
  ): Promise<{ certificateUrl: string | null }> {
    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: { id: enrollmentId },
      select: { studentId: true, status: true },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    const isAdmin = role === 'SUPER_ADMIN' || role === 'SUB_ADMIN';
    if (!isAdmin && !(role === 'STUDENT' && enrollment.studentId === userId)) {
      throw new ForbiddenException('Not your enrollment');
    }
    if (enrollment.status !== 'FINISHED') {
      throw new ForbiddenException(
        'A certificate is only available once the course is completed',
      );
    }
    const certificateUrl = await this.issueForEnrollment(enrollmentId);
    return { certificateUrl };
  }
}
