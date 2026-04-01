const MetricsService = (() => {
    async function getNodeLatest(nodeId) {
        return Api.get(`/api/nodes/${nodeId}/metrics/latest`);
    }
    async function getNodeTimeseries(nodeId, from, to, step = 60) {
        return Api.get(`/api/nodes/${nodeId}/metrics/timeseries?from=${from}&to=${to}&step=${step}`);
    }
    async function getMcServerLatest(mcServerId) {
        return Api.get(`/api/mc-servers/${mcServerId}/metrics/latest`);
    }
    async function getMcServerTimeseries(mcServerId, from, to, step = 60) {
        return Api.get(`/api/mc-servers/${mcServerId}/metrics/timeseries?from=${from}&to=${to}&step=${step}`);
    }
    return { getNodeLatest, getNodeTimeseries, getMcServerLatest, getMcServerTimeseries };
})();
