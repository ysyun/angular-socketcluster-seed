import Config from '../../config';
import { clean } from '../../utils';

/**
 * Executes the build process, cleaning all files within the `/public/dev` directory.
 */
export = clean([Config.COVERAGE_DIR, Config.COVERAGE_TS_DIR]);
