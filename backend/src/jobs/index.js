// src/jobs/index.js
// Starts all BullMQ workers

const startWorkers = () => {
  console.log('\n🔧 Starting BullMQ Workers...');

  try {
    require('./videoPublish.job');
    console.log('✅ Video publish worker started');
  } catch (err) {
    console.warn('⚠️  Video publish worker skipped:', err.message);
  }

  console.log('✅ Workers init complete\n');
};

module.exports = { startWorkers };
