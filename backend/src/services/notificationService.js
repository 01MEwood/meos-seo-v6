import nodemailer from 'nodemailer';
import { logger } from './logger.js';

/**
 * NotificationService — E-Mail-Benachrichtigungen für Alerts
 */
export class NotificationService {
  constructor(prisma, skillService) {
    this.prisma = prisma;
    this.skillService = skillService;

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ionos.de',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    });
  }

  /**
   * Ungesendete Alerts per E-Mail verschicken
   */
  async sendPendingAlerts() {
    let timelineConfig;
    try {
      timelineConfig = await this.skillService.load('timeline');
    } catch {
      return;
    }

    const notifications = timelineConfig.notifications || {};
    if (!notifications.email?.length) return;

    // Ungelesene Alerts der letzten 24h (WARNING + CRITICAL)
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const alerts = await this.prisma.alert.findMany({
      where: {
        isRead: false,
        severity: { in: ['WARNING', 'CRITICAL'] },
        createdAt: { gte: since },
      },
      orderBy: { severity: 'asc' },
    });

    if (alerts.length === 0) return;

    // E-Mail zusammenbauen
    const criticals = alerts.filter(a => a.severity === 'CRITICAL');
    const warnings = alerts.filter(a => a.severity === 'WARNING');

    const subject = criticals.length > 0
      ? `MEOS:SEO — ${criticals.length} kritische Alerts`
      : `MEOS:SEO — ${warnings.length} Warnungen`;

    const html = this.buildAlertEmail(criticals, warnings);

    try {
      await this.transporter.sendMail({
        from: `"MEOS:SEO" <${process.env.SMTP_USER || 'info@schreinerhelden.de'}>`,
        to: notifications.email.join(', '),
        subject,
        html,
      });

      logger.info(`Alert-E-Mail gesendet an ${notifications.email.join(', ')}: ${alerts.length} Alerts`);
    } catch (err) {
      logger.error(`E-Mail-Versand fehlgeschlagen: ${err.message}`);
    }
  }

  /**
   * HTML-E-Mail für Alerts generieren
   */
  buildAlertEmail(criticals, warnings) {
    const renderAlert = (alert) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">
          <span style="color:${alert.severity === 'CRITICAL' ? '#A32D2D' : '#BA7517'};font-weight:bold;">
            ${alert.severity === 'CRITICAL' ? 'KRITISCH' : 'WARNUNG'}
          </span>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">
          <strong>${alert.title}</strong><br>
          <span style="color:#666;font-size:13px;">${alert.message}</span>
        </td>
      </tr>`;

    return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#EE7E00;color:white;padding:16px 24px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;font-size:18px;">MEOS:SEO Alert-Report</h2>
        <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">
          ${new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>
      
      <div style="background:white;border:1px solid #ddd;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
        ${criticals.length > 0 ? `
          <h3 style="color:#A32D2D;margin:0 0 12px;">Kritische Alerts (${criticals.length})</h3>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            ${criticals.map(renderAlert).join('')}
          </table>
        ` : ''}
        
        ${warnings.length > 0 ? `
          <h3 style="color:#BA7517;margin:0 0 12px;">Warnungen (${warnings.length})</h3>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            ${warnings.map(renderAlert).join('')}
          </table>
        ` : ''}
        
        <p style="color:#666;font-size:13px;margin:16px 0 0;">
          Öffne das <a href="https://seo.meosapp.de" style="color:#EE7E00;">MEOS:SEO Dashboard</a> für Details.
        </p>
      </div>
    </div>`;
  }

  /**
   * Erfolgs-Benachrichtigung (Meilensteine)
   */
  async sendMilestoneEmail(milestone, score) {
    let timelineConfig;
    try {
      timelineConfig = await this.skillService.load('timeline');
    } catch {
      return;
    }

    const emails = timelineConfig.notifications?.email || [];
    if (emails.length === 0) return;

    try {
      await this.transporter.sendMail({
        from: `"MEOS:SEO" <${process.env.SMTP_USER || 'info@schreinerhelden.de'}>`,
        to: emails.join(', '),
        subject: `MEOS:SEO — Meilenstein erreicht: Score ${milestone}!`,
        html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#0F6E56;color:white;padding:24px;border-radius:8px;text-align:center;">
            <h1 style="margin:0;font-size:48px;">${score}</h1>
            <p style="margin:8px 0 0;font-size:16px;">Gesamt-Score hat Meilenstein ${milestone} erreicht!</p>
          </div>
        </div>`,
      });
    } catch (err) {
      logger.error(`Meilenstein-E-Mail fehlgeschlagen: ${err.message}`);
    }
  }
}
