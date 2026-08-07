const DB_NAME = 'autoScriber_ClientDB';
const DB_VERSION = 1;

let dbPromise = null;

export function getDB() {
  if (!('indexedDB' in window)) {
    return Promise.reject(new Error('This browser does not support IndexedDB.'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('jobs')) {
          const jobStore = db.createObjectStore('jobs', { keyPath: 'id' });
          jobStore.createIndex('createdAt', 'createdAt');
          jobStore.createIndex('status', 'status');
        }
        if (!db.objectStoreNames.contains('audioBlobs')) {
          db.createObjectStore('audioBlobs', { keyPath: 'jobId' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
  });
}

function get(storeName, key) {
  return getDB().then((db) => new Promise((resolve, reject) => {
    const request = db.transaction(storeName).objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}

function put(storeName, value) {
  return getDB().then((db) => new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readwrite').objectStore(storeName).put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }));
}

function getAll(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveJob(job, audioBlob = null) {
  const db = await getDB();
  const tx = db.transaction(['jobs', 'audioBlobs'], 'readwrite');
  tx.objectStore('jobs').put(job);
  if (audioBlob) {
    tx.objectStore('audioBlobs').put({ jobId: job.id, blob: audioBlob });
  }
  await txDone(tx);
}

export async function updateJob(job) {
  const db = await getDB();
  const tx = db.transaction('jobs', 'readwrite');
  tx.objectStore('jobs').put(job);
  await txDone(tx);
}

export async function getJob(jobId) {
  const job = await get('jobs', jobId);
  if (job) {
    const audioRecord = await get('audioBlobs', jobId);
    if (audioRecord && audioRecord.blob) {
      job.audioUrl = URL.createObjectURL(audioRecord.blob);
    }
  }
  return job;
}

export async function listJobs() {
  const store = (await getDB()).transaction('jobs').objectStore('jobs');
  const jobs = await getAll(store);
  jobs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return jobs;
}

export async function deleteJob(jobId) {
  const db = await getDB();
  const tx = db.transaction(['jobs', 'audioBlobs'], 'readwrite');
  tx.objectStore('jobs').delete(jobId);
  tx.objectStore('audioBlobs').delete(jobId);
  await txDone(tx);
}

export async function saveSettings(settings) {
  for (const [key, value] of Object.entries(settings)) {
    await put('settings', { key, value });
  }
}

export async function getSettings() {
  const rows = await getAll((await getDB()).transaction('settings').objectStore('settings'));
  const out = {};
  for (const row of rows) out[row.key] = row.value;
  return out;
}