const BackupsService = (() => {
    async function getAll(mcServerId) { return Api.get(`/api/backups/${mcServerId}`); }
    async function create(mcServerId) { return Api.post(`/api/backups/${mcServerId}`); }
    async function restore(backupId)  { return Api.post(`/api/backups/${backupId}/restore`); }
    async function remove(backupId)   { return Api.delete(`/api/backups/${backupId}`); }
    return { getAll, create, restore, remove };
})();
