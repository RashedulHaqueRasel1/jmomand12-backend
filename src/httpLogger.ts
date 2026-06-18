import pinoHttp from 'pino-http';
import logger from './logger';

const httpLogger = pinoHttp({
  logger,
  customLogLevel: (req, res, error) => {
    if (res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
});

export default httpLogger;
