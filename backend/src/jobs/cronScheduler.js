import { logger } from '../services/logger.js';

/**
 * CronScheduler — Zeitgesteuerte Jobs
 * 
 * Schedule kommt aus dem timeline.skill:
 *   snapshotSchedule: "0 3 * * *" (täglich 03:00)
 * 
 * Feste Jobs:
 *   - Täglich 03:00: Snapshot erstellen
 *   - Täglich 03:30: SERP-Tracking (DataForSEO)
 *   - Täglich 06:00: Alert-E-Mails versenden
 *   - Wöchentlich Mo 02:00: SEO-Audit
 *   - Wöchentlich Mi 02:00: LLM-Tracking
 *   - Monatlich 1. 04:00: Retention anwenden
 */
export class CronScheduler {
  constructor(prisma, jobQueue) {
    this.prisma = prisma;
    this.jobQueue = jobQueue;
    this.intervals = [];
  }

  /**
   * Alle Cronjobs starten
   */
  start() {
    logger.info('CronScheduler gestartet');

    // Täglich 03:00 — Snapshot
    this.scheduleDaily(3, 0, 'create-snapshot', 'Täglicher Snapshot');

    // Täglich 03:30 — SERP-Tracking
    this.scheduleDaily(3, 30, 'track-serp', 'SERP-Tracking');

    // Täglich 06:00 — Alert-E-Mails
    this.scheduleDaily(6, 0, 'send-alerts', 'Alert-E-Mails');

    // Wöchentlich Montag 02:00 — SEO-Audit
    this.scheduleWeekly(1, 2, 0, 'run-audit', 'Wöchentlicher SEO-Audit');

    // Wöchentlich Mittwoch 02:00 — LLM-Tracking
    this.scheduleWeekly(3, 2, 0, 'track-llm', 'Wöchentliches LLM-Tracking');

    // Monatlich 1. um 04:00 — Retention
    this.scheduleMonthly(1, 4, 0, 'apply-retention', 'Monatliche Daten-Retention');
  }

  /**
   * Alle Cronjobs stoppen
   */
  stop() {
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals = [];
    logger.info('CronScheduler gestoppt');
  }

  /**
   * Täglichen Job planen
   */
  scheduleDaily(hour, minute, jobName, label) {
    const check = () => {
      const now = new Date();
      if (now.getHours() === hour && now.getMinutes() === minute) {
        this.triggerJob(jobName, label);
      }
    };

    // Jede Minute prüfen
    const interval = setInterval(check, 60 * 1000);
    this.intervals.push(interval);

    logger.info(`  Cron: ${label} → täglich ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  }

  /**
   * Wöchentlichen Job planen (dayOfWeek: 0=So, 1=Mo, ..., 6=Sa)
   */
  scheduleWeekly(dayOfWeek, hour, minute, jobName, label) {
    const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const check = () => {
      const now = new Date();
      if (now.getDay() === dayOfWeek && now.getHours() === hour && now.getMinutes() === minute) {
        this.triggerJob(jobName, label);
      }
    };

    const interval = setInterval(check, 60 * 1000);
    this.intervals.push(interval);

    logger.info(`  Cron: ${label} → ${days[dayOfWeek]} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  }

  /**
   * Monatlichen Job planen
   */
  scheduleMonthly(dayOfMonth, hour, minute, jobName, label) {
    const check = () => {
      const now = new Date();
      if (now.getDate() === dayOfMonth && now.getHours() === hour && now.getMinutes() === minute) {
        this.triggerJob(jobName, label);
      }
    };

    const interval = setInterval(check, 60 * 1000);
    this.intervals.push(interval);

    logger.info(`  Cron: ${label} → ${dayOfMonth}. des Monats ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  }

  /**
   * Job auslösen — erstellt DB-Eintrag und fügt in Queue ein
   */
  async triggerJob(jobName, label) {
    try {
      // System-User für Cron-Jobs (erster Admin)
      const admin = await this.prisma.user.findFirst({ where: { role: 'ADMIN' } });
      if (!admin) {
        logger.error(`Cron: Kein Admin-User gefunden für ${label}`);
        return;
      }

      const job = await this.prisma.job.create({
        data: {
          type: jobName.replace(/-/g, '_'),
          payload: { triggeredBy: 'cron', label },
          createdById: admin.id,
        },
      });

      await this.jobQueue.add(jobName, { jobId: job.id });
      logger.info(`Cron: ${label} ausgelöst (Job ${job.id})`);
    } catch (err) {
      logger.error(`Cron-Fehler (${label}): ${err.message}`);
    }
  }
}
