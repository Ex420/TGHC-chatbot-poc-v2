// Anonymous, client-only identity used to attribute /api/chat logging
// (see conversations table) without a real user account system.
const USER_IDENTIFIER_KEY = "tghc_user_identifier";
const SESSION_ID_KEY = "tghc_session_id";

function getOrCreateId(storage, key) {
  let id = storage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    storage.setItem(key, id);
  }
  return id;
}

// localStorage persists across visits; sessionStorage resets per tab/session.
export function getUserIdentity() {
  const userIdentifier = getOrCreateId(window.localStorage, USER_IDENTIFIER_KEY);
  const sessionId = getOrCreateId(window.sessionStorage, SESSION_ID_KEY);
  return {
    userIdentifier,
    sessionId,
    userName: `User-${userIdentifier.slice(0, 8)}`,
  };
}
