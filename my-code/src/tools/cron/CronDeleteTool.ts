/**
 * CronDeleteTool — Cancel a scheduled cron job by its ID.
 */

import { z } from 'zod';
import { buildTool } from '../Tool.js';
import { getCronJob, removeCronJob } from '../../utils/cronScheduler.js';

export const CronDeleteTool = buildTool({
  name: 'CronDelete',
  description:
    'Cancel a scheduled cron job by its ID. The job stops immediately — ' +
    'it will not fire again even if its next run time has not been reached. ' +
    'Use CronList to find job IDs.',

  inputSchema: z.object({
    id: z.string().describe(
      'Job ID as returned by CronCreate (e.g. "cabc123"). Use CronList to find IDs.',
    ),
  }),

  isReadOnly: () => false,
  isDestructive: () => true,

  async call({ id }) {
    const job = getCronJob(id);
    if (!job) {
      return (
        `Error: No scheduled job with id '${id}'. ` +
        `Use CronList to see all active job IDs.`
      );
    }

    removeCronJob(id);
    return `Cancelled job ${id} (${job.humanSchedule}).`;
  },

  getActivityDescription(input) {
    return `cancelling cron job: ${input.id}`;
  },
});
