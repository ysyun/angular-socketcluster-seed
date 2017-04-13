import * as path from 'path';
import * as url from 'url';
import * as fs from 'fs-extra';
import * as _ from 'underscore';
const httpProxy = require('http-proxy');
const debug = require('debug')('server:upstream');

module.exports = function (options: any) {
    if (!options) {
        options = {};
    }

    const server = options.server, proxy = options.proxy, stub = options.stub;
    const upstream = httpProxy.createProxyServer({ timeout: 600000 });
    let socket2origin: any = {};
    upstream.on('error', debug);

    server.on('upgrade', (req: any, socket: any, head: any) => {
        let socketId = req.url.match(/^\/socket\.io\/1\/websocket\/(.+)$/);
        if (socketId) {
            socketId = socketId[1];
        }
        const origin = socket2origin[socketId];
        if (!origin) {
            return console.log(`Origin for socket ${socketId} is undefined. Is socket.io properly setup?`);
        }
        const target = origin.proxy === 'stubs' ? stub : proxy;
        return target.then((instance: any) => {
            const ref = instance.address(), address = ref.address, port = ref.port;
            const host = `http://${address}:${port}/`;
            return upstream.ws(req, socket, head, {
                target: host
            });
        });
    });

    return function (req: any, res: any, next: any) {
        // default is stub server
        let target = options.stub;
        if (req.origin && req.origin.proxy && req.origin.proxy !== 'stubs') {
           target = options.proxy;
        }
        return target.then(function (instance: any) {
            const ref = instance.address(), address = ref.address, port = ref.port;
            const host = `http://${address}:${port}/`;
            if (!req.url.indexOf('/socket.io/1/xhr-polling')) {
                return res.status(404).end();
            } else if (!req.url.indexOf('/socket.io/1')) {
                res.write = _.wrap(res.write, function (fn: any, chunk: any, encoding: any, callback: any) {
                    const socket = chunk.toString('utf8').split(':')[0];
                    socket2origin[socket] = req.origin;
                    return fn.call(this, chunk, encoding, callback);
                });
            }
            console.log('> forward ' + req.url + ' to ' + host);
            return upstream.web(req, res, {
                target: host
            }, (err: any, req: any, res: any, target: any) => {
                if (typeof target === 'object') {
                    target = url.format(target);
                }
                return res.status(500).send(`Error connecting to upstream at ${target}`);
            });
        });
    };
};
