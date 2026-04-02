const Api = (() => {
  const BASE =
    localStorage.getItem('apiBase') ||
    window.__API_BASE__ ||
    'http://localhost:8080';

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
      localStorage.removeItem('refreshToken');
      window.location.href = 'auth.html';
      return;
    }

    if (res.status === 204) return null;

    const contentType = res.headers.get('content-type') || '';

    if (!res.ok) {
      let err = {};
      if (contentType.includes('application/json')) {
        err = await res.json().catch(() => ({}));
      } else {
        const text = await res.text().catch(() => '');
        err = { message: text || res.statusText };
      }
      throw new Error(err.message || err.error || res.statusText || 'Request failed');
    }

    if (contentType.includes('application/json')) {
      return res.json();
    }

    return res.text();
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

      const res = await fetch(BASE + path, {
        method: 'POST',
        headers,
        body: formData
      });

      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = 'auth.html';
        return;
      }

      if (res.status === 204) return null;

      const contentType = res.headers.get('content-type') || '';

      if (!res.ok) {
        let err = {};
        if (contentType.includes('application/json')) {
          err = await res.json().catch(() => ({}));
        } else {
          const text = await res.text().catch(() => '');
          err = { message: text || res.statusText };
        }
        throw new Error(err.message || err.error || res.statusText || 'Upload failed');
      }

      if (contentType.includes('application/json')) {
        return res.json();
      }

      return res.text();
    }
  };
})();