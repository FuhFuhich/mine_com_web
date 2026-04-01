const FilesService = (() => {
    function encPath(p) { return encodeURIComponent(p); }

    async function getTree(mcServerId, path = '/') {
        return Api.get(`/api/mc-servers/${mcServerId}/files/tree?path=${encPath(path)}`);
    }
    async function getContent(mcServerId, path) {
        return Api.get(`/api/mc-servers/${mcServerId}/files/content?path=${encPath(path)}`);
    }
    async function saveContent(mcServerId, path, content) {
        return Api.put(`/api/mc-servers/${mcServerId}/files/content`, { path, content });
    }
    async function mkdir(mcServerId, path) {
        return Api.post(`/api/mc-servers/${mcServerId}/files/mkdir`, { path });
    }
    async function remove(mcServerId, path) {
        return Api.delete(`/api/mc-servers/${mcServerId}/files?path=${encPath(path)}`);
    }
    async function upload(mcServerId, targetPath, file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('path', targetPath);
        return Api.upload(`/api/mc-servers/${mcServerId}/files/upload`, fd);
    }
    async function uploadModpack(mcServerId, file) {
        const fd = new FormData();
        fd.append('file', file);
        return Api.upload(`/api/mc-servers/${mcServerId}/modpack`, fd);
    }

    async function getConfigs(mcServerId) {
        try {
            return Api.get(`/api/mc-servers/${mcServerId}/configs`);
        } catch {
            return getTree(mcServerId, '/');
        }
    }
    async function getConfigContent(mcServerId, path) {
        try {
            return Api.get(`/api/mc-servers/${mcServerId}/configs/content?path=${encPath(path)}`);
        } catch {
            return getContent(mcServerId, path);
        }
    }
    async function saveConfigContent(mcServerId, path, content) {
        try {
            return Api.put(`/api/mc-servers/${mcServerId}/configs/content`, { path, content });
        } catch {
            return saveContent(mcServerId, path, content);
        }
    }

    return { getTree, getContent, saveContent, mkdir, remove, upload, uploadModpack, getConfigs, getConfigContent, saveConfigContent };
})();
