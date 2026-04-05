import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '../services/logger.js';
import { ContentPipeline } from '../services/contentPipeline.js';
import { WordPressService } from '../services/wordpressService.js';
import { LlmTrackerService } from '../services/llmTrackerService.js';
import { SnapshotService } from '../services/snapshotService.js';
import { SeoAgentService } from '../services/seoAgentService.js';
import { DataForSeoService } from '../services/dataForSeoService.js';
import { NotificationService } from '../services/notificationService.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export function createJobQueue(prisma, skillService) {
  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

  // Services initialisieren
  const pipeline = new ContentPipeline(prisma, skillService);
  const wordpress = new WordPressService(prisma);
  const llmTracker = new LlmTrackerService(prisma, skillService);
  const snapshots = new SnapshotService(prisma, skillService);
  const seoAgent = new SeoAgentService(prisma, skillService);
  const dataForSeo = new DataForSeoService(prisma);
  const notifications = new NotificationService(prisma, skillService);

  const queue = new Queue('meos-jobs', { connection });

  const worker = new Worker('meos-jobs', async (job) => {
    const { jobId } = job.data;
    logger.info(`Job gestartet: ${job.name} (${jobId})`);

    try {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      let result;

      switch (job.name) {
        case 'generate-content': {
          const dbJob = await prisma.job.findUnique({ where: { id: jobId } });
          const { region, service, skillSlug, type } = dbJob.payload;

          if (type === 'blog') {
            result = await pipeline.generateBlogPost({
              topic: region || service,
              skillSlug: skillSlug || 'blog',
              userId: dbJob.createdById,
              jobId,
            });
          } else {
            result = await pipeline.generateLandingpage({
              region: region || 'Stuttgart',
              service,
              skillSlug: skillSlug || 'landingpage',
              userId: dbJob.createdById,
              jobId,
            });
          }
          break;
        }

        case 'publish-content': {
          const dbJob = await prisma.job.findUnique({ where: { id: jobId } });
          result = await wordpress.publish(dbJob.payload.contentId);
          break;
        }

        case 'run-audit': {
          result = await seoAgent.runAudit(jobId);
          break;
        }

        case 'run-autofix': {
          result = await seoAgent.runAutoFix(jobId);
          break;
        }

        case 'track-serp': {
          result = await dataForSeo.trackAllKeywords(jobId);
          break;
        }

        case 'send-alerts': {
          await notifications.sendPendingAlerts();
          result = { message: 'Alert-E-Mails verarbeitet' };
          break;
        }

        case 'track-llm': {
          result = await llmTracker.runFullTrack(jobId);
          break;
        }

        case 'create-snapshot': {
          result = await snapshots.createDailySnapshot();
          break;
        }

        case 'apply-retention': {
          await snapshots.applyRetention();
          result = { message: 'Retention angewendet' };
          break;
        }

        default:
          throw new Error(`Unbekannter Job-Typ: ${job.name}`);
      }

      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          progress: 100,
          result: result ? JSON.parse(JSON.stringify(result, (k, v) =>
            typeof v === 'bigint' ? v.toString() : v
          )) : null,
        },
      });

      logger.info(`Job abgeschlossen: ${job.name} (${jobId})`);
    } catch (err) {
      logger.error(`Job fehlgeschlagen: ${job.name} (${jobId}): ${err.message}`);
      await prisma.job.update({
        where: { id: jobId },
        data: { status: 'FAILED', error: err.message, completedAt: new Date() },
      });
      throw err;
    }
  }, { connection, concurrency: 3 });

  worker.on('error', (err) => logger.error(`Worker-Fehler: ${err.message}`));

  return {
    add: (name, data, opts) => queue.add(name, data, opts),
    close: async () => {
      await worker.close();
      await queue.close();
      await connection.quit();
    },
    services: { pipeline, wordpress, llmTracker, snapshots, seoAgent, dataForSeo, notifications },
  };
}
