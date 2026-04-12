const FilesService = (() => {
    function encPath(path) {
        return encodeURIComponent(path || '/');
    }

    async function getTree(mcServerId, path = '/') {
        return Api.get(`/api/mc-servers/${mcServerId}/fs/list?path=${encPath(path)}`);
    }

    async function getContent(mcServerId, path) {
        return Api.get(`/api/mc-servers/${mcServerId}/fs/read?path=${encPath(path)}`);
    }

    async function saveContent(mcServerId, path, content) {
        return Api.put(`/api/mc-servers/${mcServerId}/fs/write?path=${encPath(path)}`, { content });
    }

    async function mkdir(mcServerId, path) {
        return Api.post(`/api/mc-servers/${mcServerId}/fs/mkdir?path=${encPath(path)}`);
    }

    async function remove(mcServerId, path) {
        return Api.delete(`/api/mc-servers/${mcServerId}/fs/delete?path=${encPath(path)}`);
    }

    async function getConfigs(mcServerId, path = '/') {
        return getTree(mcServerId, path);
    }

    async function getConfigContent(mcServerId, path) {
        return getContent(mcServerId, path);
    }

    async function saveConfigContent(mcServerId, path, content) {
        return saveContent(mcServerId, path, content);
    }

    async function uploadModpack(mcServerId, file) {
        const fd = new FormData();
        fd.append('file', file);
        return Api.upload(`/api/mc-servers/${mcServerId}/archives?type=mods`, fd);
    }

    return {
        getTree,
        getContent,
        saveContent,
        mkdir,
        remove,
        getConfigs,
        getConfigContent,
        saveConfigContent,
        uploadModpack
    };
})();
