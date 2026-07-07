/**
 * CronListTool — List all active scheduled cron jobs.
 */

import { z } from 'zod';
import { buildTool } from '../Tool.js';
import { listCronJobs } from '../../utils/cronScheduler.js';

export const CronListTool = buildTool({
  name: 'CronList',
  description:
    'List all currently active scheduled cron jobs with their IDs, human-readable schedules, ' +
    'next fire time, prompt preview, and whether they are recurring or one-shot. ' +
    'Use this before calling CronDelete to find the right job ID.',

  inputSchema: z.object({}),

  isReadOnly: () => true,
  isConcurrencySafe: () => true,

  async call() {
    const jobs = listCronJobs();

    if (jobs.length === 0) {
      return 'No scheduled jobs. Use CronCreate to schedule one.';
    }

    return jobs.map(j => {
      const next = new Date(j.nextRunAt).toLocaleString();
      const type = j.recurring ? 'recurring' : 'one-shot';
      const promptPreview = j.prompt.length > 80
        ? j.prompt.slice(0, 77) + '...'
        : j.prompt;
      return [
        `ID      : ${j.id}`,
        `Type    : ${type}`,
        `Schedule: ${j.humanSchedule}`,
        `Next run: ${next}`,
        `Prompt  : ${promptPreview}`,
      ].join('\n');
    }).join('\n\n');
  },

  getActivityDescription() {
    return 'listing cron jobs';
  },
});
