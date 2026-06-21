// src/jobs/index.js
// Starts all BullMQ workers

const startWorkers = () => {
  console.log('\n🔧 Starting BullMQ Workers...');

  // Part 3 — Scheduling
  require('./videoPublish.job');

  // Part 4 — Analytics (uncomment when built)
  // require('./analyticsSync.job');

  // Part 5 — AI (uncomment when built)
  // require('./aiComment.job');
  // require('./weeklyReport.job');

  console.log('✅ All workers started\n');
};

module.exports = { startWorkers };
