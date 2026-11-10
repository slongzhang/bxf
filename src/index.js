import pkg from '../package.json';
import { createClient } from "./core/createClient.js";

const bxf = createClient();
bxf.version = pkg.version;
export default bxf;