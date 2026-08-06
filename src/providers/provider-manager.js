class ProviderManager {
  constructor() {
    this.providers = new Map();
  }

  register(kind, key, provider) {
    if (!this.providers.has(kind)) this.providers.set(kind, new Map());
    this.providers.get(kind).set(key, provider);
    return provider;
  }

  get(kind, key = 'default') {
    return this.providers.get(kind)?.get(key) || null;
  }

  list(kind) {
    return [...(this.providers.get(kind)?.entries() || [])].map(([name, provider]) => ({ name, provider }));
  }
}

module.exports = {
  ProviderManager
};
