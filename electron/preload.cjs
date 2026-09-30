const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jzrm', {
  load: () => ipcRenderer.invoke('state:load'),
  save: state => ipcRenderer.invoke('state:save', state),
  saveKey: (id, key) => ipcRenderer.invoke('key:save', id, key),
  keyStatus: id => ipcRenderer.invoke('key:status', id),
  clearKey: id => ipcRenderer.invoke('key:clear', id),
  testModel: input => ipcRenderer.invoke('ai:test', input),
  localModels: () => ipcRenderer.invoke('local:models'),
  runAi: input => ipcRenderer.invoke('ai:run', input),
  generateImage: input => ipcRenderer.invoke('image:generate', input),
  imageModels: input => ipcRenderer.invoke('image:models', input),
  searchWeb: query => ipcRenderer.invoke('web:search', query),
  searchNovelWeb: query => ipcRenderer.invoke('web:novel-search', query),
  usage: () => ipcRenderer.invoke('usage:list'),
  importText: () => ipcRenderer.invoke('file:import'),
  importImage: () => ipcRenderer.invoke('image:import'),
  exportFile: input => ipcRenderer.invoke('file:export', input),
  backup: () => ipcRenderer.invoke('state:backup'),
  restoreBackup: () => ipcRenderer.invoke('state:restore'),
  cloudPush: state => ipcRenderer.invoke('sync:push', state),
  cloudPull: () => ipcRenderer.invoke('sync:pull'),
  cloudStatus: () => ipcRenderer.invoke('sync:status'),
  appVersion: () => ipcRenderer.invoke('app:version')
});
