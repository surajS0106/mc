/**
 * CronCreateTool — Schedule a recurring or one-shot prompt via cron expression.
 */

import { z } from 'zod';
import { buildTool } from '../Tool.js';
import { parseCron, cronToHuman, nextCronDate } from '../../utils/cronParser.js';
import { addCronJob, getCronJobCount, MAX_JOBS } from '../../utils/cronScheduler.js';

export const CronCreateTool = buildTool({
  name: 'CronCreate',
  description:
    'Schedule a recurring or one-shot prompt using a standard 5-field cron expression. ' +
    'At each fire time the prompt is injected automatically as a task notification. ' +
    'Use for reminders ("remind me in 10 mins"), monitoring ("check test results every 5 mins"), ' +
    'or periodic summaries ("summarise progress at 5pm daily"). ' +
    'Cron format: "M H DoM Mon DoW" in local time — e.g. "*/5 * * * *" = every 5 minutes, ' +
    '"0 17 * * 1-5" = 5pm weekdays, "30 14 28 2 *" = Feb 28 at 2:30pm (one-shot).',

  inputSchema: z.object({
    cron: z.string().describe(
      'Standard 5-field cron expression in local time: "M H DoM Mon DoW". ' +
      'Fields: Minute(0-59) Hour(0-23) DayOfMonth(1-31) Month(1-12) DayOfWeek(0-6, Sun=0). ' +
      'Supports *(any), */n(step), a-b(range), a,b(list). ' +
      'Examples: "*/5 * * * *" every 5 min, "0 9 * * 1" every Monday 9am.',
    ),
    prompt: z.string().describe(
      'The prompt text to inject when this job fires. ' +
      'Be specific — the prompt runs without the surrounding conversation context.',
    ),
    recurring: z.boolean().optional().default(true).describe(
      'true (default) = repeat on every cron match until deleted. ' +
      'false = fire once at the very next match, then auto-delete. ' +
      'Use false for one-shot reminders (e.g. "remind me at 3pm today").',
    ),
  }),

  isReadOnly: () => false,
  isDestructive: () => false,

  async call(input) {
    const { cron, prompt, recurring = true } = input;

    // Validate expression
    if (!parseCron(cron)) {
      return (
        `Error: Invalid cron expression '${cron}'. ` +
        `Expected 5 whitespace-separated fields: M H DoM Mon DoW. ` +
        `Example: "*/5 * * * *" (every 5 minutes).`
      );
    }

    // Check the expression actually fires within the next year
    const next = nextCronDate(cron, Date.now());
    if (!next) {
      return (
        `Error: Cron expression '${cron}' does not match any date in the next year. ` +
        `Check your field ranges.`
      );
    }

    // Cap the number of active jobs
    if (getCronJobCount() >= MAX_JOBS) {
      return (
        `Error: Too many active scheduled jobs (max ${MAX_JOBS}). ` +
        `Use CronDelete to cancel a job first.`
      );
    }

    const job = addCronJob(cron, prompt, recurring);
    const type = recurring ? 'recurring' : 'one-shot';
    const nextStr = next.toLocaleString();

    return [
      `Scheduled ${type} job: ${job.id}`,
      `Schedule : ${job.humanSchedule}`,
      `Next run : ${nextStr}`,
      recurring
        ? `Repeats automatically. Use CronDelete to cancel.`
        : `Will fire once then auto-delete.`,
    ].join('\n');
  },

  getActivityDescription(input) {
    return `scheduling cron: ${cronToHuman(input.cron)}`;
  },
});
