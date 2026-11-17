import { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { deleteUser, listUsers, saveUserProfile, updateUser } from "../../../shared/services/firestoreApi";
import type { FirestoreUser } from "../../../shared/types/firestore";
import { cn } from "../../../shared/utils/ui";

type OutsiderForm = {
  name: string;
  teamMemberTwoName: string;
  dateOfBirth: string;
  teamMemberTwoDob: string;
  mobileNumber: string;
  email: string;
  postalPincode: string;
};

const emptyForm: OutsiderForm = { name: "", teamMemberTwoName: "", dateOfBirth: "", teamMemberTwoDob: "", mobileNumber: "", email: "", postalPincode: "" };
const inputClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-200";

export default function OutsiderMasterPage() {
  const [outsiders, setOutsiders] = useState<FirestoreUser[]>([]);
  const [form, setForm] = useState<OutsiderForm>(emptyForm);
  const [editing, setEditing] = useState<FirestoreUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { setOutsiders((await listUsers()).filter((u) => u.userType === "other")); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const setField = (key: keyof OutsiderForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const edit = (user: FirestoreUser) => {
    setEditing(user);
    setForm({ name: user.name ?? "", teamMemberTwoName: user.teamMemberTwoName ?? "", dateOfBirth: user.dateOfBirth ?? "", teamMemberTwoDob: user.teamMemberTwoDob ?? "", mobileNumber: user.mobileNumber ?? user.employeeId ?? "", email: user.email ?? "", postalPincode: user.postalPincode ?? "" });
    setMessage(null);
  };
  const reset = () => { setEditing(null); setForm(emptyForm); setMessage(null); };

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage(null);
    try {
      const mobile = form.mobileNumber.trim();
      if (!/^\d{10}$/.test(mobile)) throw new Error("Mobile number must be exactly 10 digits");
      if (editing) await updateUser(editing.uid, { ...form, employeeId: mobile, mobileNumber: mobile, userType: "other", displayName: form.name });
      else { const uid = `other_${mobile}`; await saveUserProfile(uid, { uid, role: "employee", ...form, employeeId: mobile, mobileNumber: mobile, userType: "other", displayName: form.name }); }
      await load(); reset(); setMessage("Outsider details saved successfully.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save outsider details"); }
    finally { setSaving(false); }
  };

  const remove = async (user: FirestoreUser) => {
    if (!window.confirm(`Delete outsider ${user.name ?? user.mobileNumber ?? "record"}?`)) return;
    await deleteUser(user.uid); await load(); if (editing?.uid === user.uid) reset();
  };

  return <AdminLayout>
    <div className="max-w-6xl mx-auto space-y-6">
      <div><h1 className="text-xl font-semibold text-slate-900">Outsider Master</h1><p className="mt-1 text-sm text-slate-500">Save, edit, and delete external quiz participant details.</p></div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <form onSubmit={save} className="bg-white rounded-lg border border-brand-100 p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">{editing ? "Edit outsider" : "Add outsider"}</h2>
          {([['name','Name of first team member','text'],['teamMemberTwoName','Name of second team member','text'],['dateOfBirth','DOB of first team member','date'],['teamMemberTwoDob','DOB of second team member','date'],['mobileNumber','Mobile number','tel'],['email','Email ID','email'],['postalPincode','Postal Pincode','text']] as const).map(([key,label,type]) => <label key={key} className="block text-xs font-medium text-slate-700">{label}<span className="text-red-500"> *</span><input required type={type} value={form[key]} onChange={(e) => setField(key, e.target.value)} className={cn(inputClass, "mt-1")} readOnly={editing !== null && key === "mobileNumber"} /></label>)}
          {message && <p className="rounded-md bg-brand-50 px-3 py-2 text-xs text-slate-700">{message}</p>}
          <div className="flex gap-2"><button disabled={saving} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white">{saving ? "Saving..." : editing ? "Update" : "Save"}</button>{editing && <button type="button" onClick={reset} className="rounded-md border border-slate-300 px-4 py-2 text-sm">Cancel</button>}</div>
        </form>
        <div className="bg-white rounded-lg border border-brand-100 shadow-sm overflow-hidden"><div className="border-b border-brand-100 px-5 py-4"><h2 className="text-sm font-semibold text-slate-900">Registered outsiders ({outsiders.length})</h2></div>{loading ? <p className="p-5 text-sm text-slate-500">Loading...</p> : outsiders.length === 0 ? <p className="p-5 text-sm text-slate-500">No outsider records found.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Team members</th><th className="px-4 py-3">Mobile</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{outsiders.map((user) => <tr key={user.uid}><td className="px-4 py-3 font-medium text-slate-800">{user.name}<br />{user.teamMemberTwoName}</td><td className="px-4 py-3">{user.mobileNumber ?? user.employeeId}</td><td className="px-4 py-3">{user.email}</td><td className="px-4 py-3 whitespace-nowrap"><button onClick={() => edit(user)} className="mr-3 text-brand-700">Edit</button><button onClick={() => void remove(user)} className="text-red-600">Delete</button></td></tr>)}</tbody></table></div>}</div>
      </div>
    </div>
  </AdminLayout>;
}
