// BullMQ workers disabled — Upstash free plan blocks evalsha
const logger = require('../config/logger');

const startWorkers = () => {
  logger.warn('BullMQ workers disabled (Upstash free plan limitation)');
};

module.exports = { startWorkers };
