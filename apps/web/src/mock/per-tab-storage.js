// Mock mode only: put in index.html by vite.config.ts, so it runs before the app's code.
//
// Each tab gets a mock world of its own: the mock's data, and what the app remembers about the
// accounts and spaces it holds, go to sessionStorage (one per tab, kept across reloads) instead
// of localStorage (shared by every tab). The theme and other conveniences stay shared.
;(() => {
  const ownPerTab = (key) => typeof key === 'string' && (key === 'teamshelf.mock' || key === 'teamshelf.accounts' || key.startsWith('teamshelf:space:'))
  const proto = Storage.prototype
  const { getItem, setItem, removeItem } = proto
  const target = (storage, key) => (storage === window.localStorage && ownPerTab(key) ? window.sessionStorage : storage)
  proto.getItem = function (key) {
    return getItem.call(target(this, key), key)
  }
  proto.setItem = function (key, value) {
    return setItem.call(target(this, key), key, value)
  }
  proto.removeItem = function (key) {
    return removeItem.call(target(this, key), key)
  }
})()
