class DbStatusStore {
  openFailed = $state(false);
}

export const dbStatus = new DbStatusStore();
