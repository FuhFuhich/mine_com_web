const NodesService = (() => {
    async function getAll()        { return Api.get('/api/nodes'); }
    async function getById(id)     { return Api.get(`/api/nodes/${id}`); }
    async function create(data)    { return Api.post('/api/nodes', data); }
    async function update(id, data){ return Api.patch(`/api/nodes/${id}`, data); }
    async function remove(id)      { return Api.delete(`/api/nodes/${id}`); }
    async function ping(id)        { return Api.post(`/api/nodes/${id}/check`); }

    async function getMembers(id) { return Api.get(`/api/nodes/${id}/members`); }

    async function addMember(nodeId, userId, role) {
        return Api.post(`/api/nodes/${nodeId}/members`, { userId, role });
    }
    async function updateMemberRole(nodeId, userId, role) {
        return Api.patch(`/api/nodes/${nodeId}/members/${userId}`, { role });
    }
    async function removeMember(nodeId, userId) {
        return Api.delete(`/api/nodes/${nodeId}/members/${userId}`);
    }
    async function findByUsername(username) {
        return Api.get(`/api/users/find?username=${encodeURIComponent(username)}`);
    }

    return { getAll, getById, create, update, remove, ping, getMembers, addMember, updateMemberRole, removeMember, findByUsername };
})();
