import path from 'path';
import { watchLog } from './log/reader.js';

const logPath = process.env.MTGA_LOG_PATH
  ?? path.join(process.env.APPDATA ?? '', '..', 'LocalLow', 'Wizards Of The Coast', 'MTGA', 'Player.log');

watchLog(logPath);
