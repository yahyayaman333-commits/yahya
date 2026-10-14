import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createGameServer} from './network-server.mjs';
export {createGameServer};
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const app=await createGameServer();console.log(`Istanbul multiplayer listening on port ${app.address.port} (5 rooms, 5 players)`);for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>app.close().then(()=>process.exit(0)));}
