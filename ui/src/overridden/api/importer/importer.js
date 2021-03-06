import { http } from '@inveniosoftware/react-invenio-app-ils';

const importerURL = '/importer';
const headers = {
  headers: {
    'Content-Type': 'multipart/form-data',
  },
};
const createTask = async formData => {
  return await http.post(`${importerURL}`, formData, headers);
};

const check = async (taskId, nextEntry = 0) => {
  const importerCheckURL = '/check/';
  return await http.get(
    `${importerURL}${importerCheckURL}${taskId}/next/${nextEntry}`
  );
};

const list = async () => {
  return await http.get(`${importerURL}/list`);
};

export const importerApi = {
  check: check,
  createTask: createTask,
  list: list,
  url: importerURL,
};
