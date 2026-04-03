const ConsoleStreamService = (() => {
    function _ensureDeps() {
        if (typeof StompJs === 'undefined') {
            throw new Error('StompJS is not loaded');
        }
        if (typeof SockJS === 'undefined') {
            throw new Error('SockJS is not loaded');
        }
    }

    function _parseMessage(body) {
        try {
            const data = JSON.parse(body);
            if (typeof data === 'string') {
                return { line: data };
            }
            return data || {};
        } catch {
            return { line: body };
        }
    }

    async function connect(serverId, handlers = {}) {
        _ensureDeps();

        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('Authentication token is missing');
        }

        let subscription = null;
        let settled = false;
        let manualClose = false;
        let connectionHandle = null;

        const client = new StompJs.Client({
            webSocketFactory: () => new SockJS(`${Api.getBase()}/ws`),
            connectHeaders: {
                Authorization: `Bearer ${token}`,
            },
            reconnectDelay: 0,
            heartbeatIncoming: 20000,
            heartbeatOutgoing: 20000,
            debug: () => {},
        });

        connectionHandle = {
            serverId,
            get connected() {
                return !!client.connected;
            },
            async disconnect() {
                manualClose = true;
                try {
                    await Api.post(`/api/console/${serverId}/stop`);
                } catch {
                    // ignore stop errors during manual disconnect
                }
                try {
                    subscription?.unsubscribe();
                } catch {
                    // ignore unsubscribe errors
                }
                subscription = null;
                try {
                    await client.deactivate();
                } catch {
                    // ignore deactivate errors
                }
            },
        };

        return new Promise((resolve, reject) => {
            const fail = async (error) => {
                const err = error instanceof Error ? error : new Error(String(error || 'WebSocket error'));
                if (!settled) {
                    settled = true;
                    try {
                        subscription?.unsubscribe();
                    } catch {
                        // ignore unsubscribe errors
                    }
                    subscription = null;
                    try {
                        await client.deactivate();
                    } catch {
                        // ignore deactivate errors
                    }
                    reject(err);
                    return;
                }
                handlers.onError?.(err);
            };

            client.onConnect = async () => {
                try {
                    subscription = client.subscribe(`/topic/console/${serverId}`, message => {
                        const payload = _parseMessage(message.body);
                        handlers.onLine?.(payload);
                    });

                    await Api.post(`/api/console/${serverId}/start`);
                    handlers.onConnect?.();

                    if (!settled) {
                        settled = true;
                        resolve(connectionHandle);
                    }
                } catch (err) {
                    await fail(err);
                }
            };

            client.onStompError = async frame => {
                await fail(new Error(frame?.headers?.message || 'STOMP error'));
            };

            client.onWebSocketError = async () => {
                await fail(new Error('WebSocket error'));
            };

            client.onWebSocketClose = () => {
                if (!manualClose) {
                    handlers.onDisconnect?.();
                }
            };

            client.activate();
        });
    }

    return { connect };
})();
