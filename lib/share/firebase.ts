import type { ShareTransport, Updates } from "./transport";

// Next.js inlines NEXT_PUBLIC_* only when referenced literally.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = () => !!(config.apiKey && config.databaseURL && config.projectId);

/**
 * Firebase Realtime Database transport. The SDK is loaded on demand so the
 * board itself stays light. Writes are restricted by the database rules in
 * PARTILHA.md: only the anonymous user that claimed a board can write to it.
 */
export async function createFirebaseTransport(): Promise<ShareTransport> {
  const [{ initializeApp, getApps }, authMod, db] = await Promise.all([
    import("firebase/app"),
    import("firebase/auth"),
    import("firebase/database"),
  ]);
  const app = getApps()[0] ?? initializeApp(config);
  const auth = authMod.getAuth(app);
  const database = db.getDatabase(app);
  db.goOnline(database); // a previous share in this tab may have gone offline
  let boardId = "";
  const subs: (() => void)[] = [];

  const ensureUser = async () => {
    if (auth.currentUser) return auth.currentUser;
    await auth.authStateReady();
    return auth.currentUser ?? (await authMod.signInAnonymously(auth)).user;
  };

  return {
    kind: "firebase",
    async host(id) {
      boardId = id;
      const user = await ensureUser();
      const owner = db.ref(database, `owners/${id}`);
      const res = await db.runTransaction(owner, (cur) => (cur === null || cur === user.uid ? user.uid : undefined));
      if (!res.committed) throw new Error("not-owner");
    },
    async write(updates: Updates) {
      await db.update(db.ref(database, `boards/${boardId}`), updates);
    },
    async set(path, value) {
      await db.set(db.ref(database, `boards/${boardId}/${path}`), value);
    },
    watch(id, path, cb) {
      const off = db.onValue(db.ref(database, `boards/${id}/${path}`), (snap) => cb(snap.val()));
      subs.push(off);
      return off;
    },
    async join(id) {
      const me = db.push(db.ref(database, `boards/${id}/viewers`));
      await db.onDisconnect(me).remove();
      await db.set(me, true);
      return () => void db.remove(me);
    },
    close() {
      subs.splice(0).forEach((off) => off());
      db.goOffline(database);
    },
  };
}
