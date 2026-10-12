import { createContext, useContext, useState, type ReactNode } from "react";
import { demoPeople, demoPosts, demoUsers } from "./data";
import { mergePersonReferences, type Person, type Post } from "./model";
type User = (typeof demoUsers)[number];
type Store = {
  walkins: string[];
  setWalkins: React.Dispatch<React.SetStateAction<string[]>>;
  mergePeople: (survivor: Person, removedId: string) => void;
  people: Person[];
  posts: Post[];
  role: "Volunteer" | "Admin";
  setRole: (r: "Volunteer" | "Admin") => void;
  updatePerson: (id: string, patch: Partial<Person>) => void;
  setPeople: React.Dispatch<React.SetStateAction<Person[]>>;
  savePost: (post: Post, reason?: string) => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  audit: string[];
  record: (text: string) => void;
  toast: string;
  notify: (text: string) => void;
  failSave: boolean;
  setFailSave: (v: boolean) => void;
  reset: () => void;
  recoveryPublished: boolean;
  setRecoveryPublished: (v: boolean) => void;
  finalised: boolean;
  setFinalised: (v: boolean) => void;
};
const Context = createContext<Store | null>(null);
export function DemoProvider({ children }: { children: ReactNode }) {
  const [walkins, setWalkins] = useState<string[]>([]);
  const [people, setPeople] = useState(demoPeople);
  const [posts, setPosts] = useState(demoPosts);
  const [role, setRole] = useState<"Volunteer" | "Admin">("Volunteer");
  const [users, setUsers] = useState(demoUsers);
  const [audit, setAudit] = useState([
    "Edini published this week’s Recovery list · Today, 9:00 am",
    "Jeff posted Expected results · Yesterday, 12:18 pm",
    "Amara Okafor assigned permanently to Odera · 8 Oct",
  ]);
  const [toast, setToast] = useState("");
  const [failSave, setFailSave] = useState(false);
  const [recoveryPublished, setRecoveryPublished] = useState(false);
  const [finalised, setFinalised] = useState(false);
  const notify = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 4500);
  };
  const record = (text: string) => setAudit((a) => [`${text} · Just now`, ...a]);
  const updatePerson = (id: string, patch: Partial<Person>) => {
    setPeople((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    record("Updated follow-up details");
  };
  const savePost = (post: Post, reason?: string) => {
    setPosts((p) =>
      p.some((x) => x.id === post.id) ? p.map((x) => (x.id === post.id ? post : x)) : [post, ...p],
    );
    record(`${post.author} — ${post.state}${reason ? `: ${reason}` : ""}`);
  };
  const mergePeople = (survivor: Person, removedId: string) => {
    setPeople((old) =>
      old.filter((p) => p.id !== removedId).map((p) => (p.id === survivor.id ? survivor : p)),
    );
    setPosts((old) => mergePersonReferences(old, survivor.id, removedId, survivor.name));
  };
  const reset = () => {
    setWalkins([]);
    setPeople(demoPeople);
    setPosts(demoPosts);
    setUsers(demoUsers);
    setRecoveryPublished(false);
    setFinalised(false);
    setFailSave(false);
    notify("Demo reset. All fictional data restored.");
  };
  return (
    <Context.Provider
      value={{
        walkins,
        setWalkins,
        mergePeople,
        people,
        posts,
        role,
        setRole,
        updatePerson,
        setPeople,
        savePost,
        users,
        setUsers,
        audit,
        record,
        toast,
        notify,
        failSave,
        setFailSave,
        reset,
        recoveryPublished,
        setRecoveryPublished,
        finalised,
        setFinalised,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useDemo() {
  const store = useContext(Context);
  if (!store) throw new Error("Demo provider missing");
  return store;
}
