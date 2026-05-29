const BASE = window.APP_CONFIG.API_BASE_URL;

const getToken = () => localStorage.getItem('fc_token');

const request = async (method, path, body = null, isFormData = false) => {
  const token   = getToken();
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData && body) headers['Content-Type'] = 'application/json';

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body
      ? isFormData ? body : JSON.stringify(body)
      : null,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, data });
  return data;
};

const api = {
  get:    (path)             => request('GET',    path),
  post:   (path, body)       => request('POST',   path, body),
  patch:  (path, body)       => request('PATCH',  path, body),
  delete: (path)             => request('DELETE', path),
  upload: (path, formData)   => request('POST',   path, formData, true),
};

window.api = api;
