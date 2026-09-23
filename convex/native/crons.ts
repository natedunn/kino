import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();
crons.interval(
	'expire auth challenges',
	{ minutes: 15 },
	internal.password.clearExpiredChallenges,
	{}
);
crons.interval(
	'expire organization logo upload intents',
	{ minutes: 15 },
	internal.organizationAppearance.clearExpiredLogoUploadIntents,
	{}
);
crons.interval(
	'expire profile avatar upload intents',
	{ minutes: 15 },
	internal.profiles.clearExpiredAvatarUploadIntents,
	{}
);
crons.interval(
	'reconcile orphaned image uploads',
	{ hours: 6 },
	internal.imageUpload.reconcileOrphanedImages,
	{}
);
crons.interval('scan operational alerts', { minutes: 5 }, internal.operations.scanAlerts, {});
crons.daily(
	'clean completed operational history',
	{ hourUTC: 7, minuteUTC: 15 },
	internal.operations.cleanupHistory,
	{}
);
export default crons;
