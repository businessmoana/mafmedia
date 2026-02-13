const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // If backend reports account deactivated, force user onto deactivated screen
    if (data?.code === 'DEACTIVATED' || data?.error === 'Account deactivated') {
      if (typeof window !== 'undefined') {
        window.location.href = '/deactivated';
      }
    }
    throw new Error(data.error || `Request failed ${res.status}`);
  }
  return data;
}

export const api = {
  auth: {
    telegram: (initData) => request('/auth/telegram', { method: 'POST', body: JSON.stringify({ initData }) }),
    devAdmin: () => request('/auth/dev-admin', { method: 'POST' }),
  },
  me: () => request('/me'),
  users: {
    list: () => request('/users'),
    setActive: (id, active) =>
      request(`/users/${id}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      }),
  },
  tasks: {
    list: () => request('/tasks'),
    get: (id) => request(`/tasks/${id}`),
    create: (data) => request('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    assignments: (id) => request(`/assignments/task/${id}`),
    updateAssignments: (id, user_ids) => request(`/tasks/${id}/assignments`, { method: 'PUT', body: JSON.stringify({ user_ids }) }),
  },
  comments: {
    list: (taskId) => request(`/tasks/${taskId}/comments`),
    add: (taskId, body, parentId = null) =>
      request(`/tasks/${taskId}/comments`, {
        method: 'POST',
        body: JSON.stringify(parentId != null ? { body, parent_id: parentId } : { body }),
      }),
    update: (taskId, commentId, body) =>
      request(`/tasks/${taskId}/comments/${commentId}`, { method: 'PATCH', body: JSON.stringify({ body }) }),
  },
};
