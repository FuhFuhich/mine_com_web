const ServersService = (() => {
    async function getAll() {
        return Api.get('/api/mc-servers');
    }

    async function getById(id) {
        return Api.get(`/api/mc-servers/${id}`);
    }

    async function create(data) {
        return Api.post('/api/mc-servers', data);
    }

    async function deploy(id) {
        return Api.post(`/api/deploy/${id}`);
    }

    async function update(id, data) {
        return Api.put(`/api/mc-servers/${id}`, data);
    }

    async function remove(id) {
        return Api.delete(`/api/mc-servers/${id}`);
    }

    async function removeDevice(id) {
        return Api.delete(`/api/mc-servers/${id}/device`);
    }

    async function start(id) {
        return Api.post(`/api/mc-servers/${id}/start`);
    }

    async function stop(id) {
        return Api.post(`/api/mc-servers/${id}/stop`);
    }

    async function restart(id) {
        return Api.post(`/api/mc-servers/${id}/restart`);
    }

    async function redeploy(id) {
        return Api.post(`/api/mc-servers/${id}/redeploy`);
    }

    async function sendRcon(id, command) {
        return Api.post(`/api/mc-servers/${id}/rcon`, { command });
    }

    async function getRecentLogs(id, lines = 500, offset = 0) {
        return Api.get(`/api/console/${id}/log?lines=${lines}&offset=${offset}`);
    }

    async function createModsShareLink(id) {
        return Api.post(`/api/mc-servers/${id}/mods/share-link`);
    }

    async function uploadModsArchive(id, file) {
        const fd = new FormData();
        fd.append('file', file);
        return Api.upload(`/api/mc-servers/${id}/archives?type=mods`, fd);
    }

    return {
        getAll,
        getById,
        create,
        deploy,
        update,
        remove,
        removeDevice,
        start,
        stop,
        restart,
        redeploy,
        sendRcon,
        getRecentLogs,
        createModsShareLink,
        uploadModsArchive
    };
})();
