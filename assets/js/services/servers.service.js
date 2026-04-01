const ServersService = (() => {
    async function getAll()          { return Api.get('/api/mc-servers'); }
    async function getById(id)       { return Api.get(`/api/mc-servers/${id}`); }
    async function create(data)      { return Api.post('/api/mc-servers', data); }
    async function update(id, data)  { return Api.patch(`/api/mc-servers/${id}`, data); }
    async function remove(id)        { return Api.delete(`/api/mc-servers/${id}`); }
    async function removeDevice(id)  { return Api.delete(`/api/mc-servers/${id}/device`); }

    async function start(id)         { return Api.post(`/api/mc-servers/${id}/start`); }
    async function stop(id)          { return Api.post(`/api/mc-servers/${id}/stop`); }
    async function restart(id)       { return Api.post(`/api/mc-servers/${id}/restart`); }
    async function redeploy(id)      { return Api.post(`/api/mc-servers/${id}/redeploy`); }

    async function sendRcon(id, command) {
        return Api.post(`/api/mc-servers/${id}/rcon`, { command });
    }

    async function getRecentLogs(id, lines = 200) {
        return Api.get(`/api/mc-servers/${id}/logs/recent?lines=${lines}`);
    }

    return { getAll, getById, create, update, remove, removeDevice, start, stop, restart, redeploy, sendRcon, getRecentLogs };
})();
