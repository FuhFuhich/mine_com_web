const MetricsService = (() => {
    async function getNodeLatest(nodeId) {
        return Api.get(`/api/nodes/${nodeId}/hardware`);
    }

    async function scanNodeHardware(nodeId) {
        return Api.post(`/api/nodes/${nodeId}/scan-hardware`);
    }

    async function getServerLatest(mcServerId) {
        return Api.get(`/api/metrics/${mcServerId}/latest`);
    }

    async function getServerHistory(mcServerId, hours = 24, page = 0, size = 100) {
        return Api.get(`/api/metrics/${mcServerId}/history?hours=${hours}&page=${page}&size=${size}`);
    }

    return {
        getNodeLatest,
        scanNodeHardware,
        getServerLatest,
        getServerHistory
    };
})();