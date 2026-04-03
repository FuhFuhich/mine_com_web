const MetricsService = (() => {
    function _normalizePage(payload) {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.content)) return payload.content;
        return [];
    }

    async function getNodeUsage(nodeId) {
        return Api.get(`/api/nodes/${nodeId}/usage`);
    }

    async function getNodeHardware(nodeId) {
        return Api.get(`/api/nodes/${nodeId}/hardware`);
    }

    async function scanNodeHardware(nodeId) {
        return Api.post(`/api/nodes/${nodeId}/scan-hardware`);
    }

    async function getServerLatest(mcServerId) {
        return Api.get(`/api/metrics/${mcServerId}/latest`);
    }

    async function getServerRuntime(mcServerId) {
        return Api.get(`/api/metrics/${mcServerId}/runtime`);
    }

    async function collectServerMetrics(mcServerId) {
        return Api.post(`/api/metrics/${mcServerId}/collect`);
    }

    async function getServerHistory(mcServerId, hours = 24, page = 0, size = 100) {
        return Api.get(`/api/metrics/${mcServerId}/history?hours=${hours}&page=${page}&size=${size}`);
    }

    async function getServerSeries(mcServerId, hours = 24, points = 480) {
        return Api.get(`/api/metrics/${mcServerId}/series?hours=${hours}&points=${points}`);
    }

    return {
        normalizePage: _normalizePage,
        getNodeUsage,
        getNodeHardware,
        scanNodeHardware,
        getServerLatest,
        getServerRuntime,
        collectServerMetrics,
        getServerHistory,
        getServerSeries
    };
})();
