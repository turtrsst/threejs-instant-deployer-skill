#!/usr/bin/env node
import {loadModule} from './build-support.mjs';
try {const {startServer}=await loadModule('server.js');await startServer();} catch(e){console.error(e.message);process.exitCode=1;}
