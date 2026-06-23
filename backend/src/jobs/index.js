// BullMQ workers disabled — Upstash free plan blocks evalsha
const startWorkers = () => {
  console.log('⚠️  BullMQ workers disabled (Upstash free plan limitation)');
};

module.exports = { startWorkers };
