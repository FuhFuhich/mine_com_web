const Api = (() => {
  const BASE = 'http://localhost:8080';

  async function _request(method, path, body) {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const res = await fetch(BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (res.status === 401) {
      localStorage.removeItem('token');
      window.location.href = 'auth.html';
      return;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || res.statusText);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  return {
    get:    (path)       => _request('GET',    path),
    post:   (path, body) => _request('POST',   path, body),
    put:    (path, body) => _request('PUT',    path, body),
    patch:  (path, body) => _request('PATCH',  path, body),
    delete: (path)       => _request('DELETE', path),
    getBase: () => BASE,

    upload: async (path, formData) => {
      const token = localStorage.getItem('token');
      const headers = {};
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const res = await fetch('http://localhost:8080' + path, {
        method: 'POST',
        headers,
        body: formData
      });
      if (res.status === 401) {
        localStorage.removeItem('token');
        window.location.href = 'auth.html';
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || res.statusText);
      }
      return res.json();
    }
};
})();