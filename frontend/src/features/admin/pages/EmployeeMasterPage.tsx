import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import AdminLayout from "../components/AdminLayout";
import {
  listUsers,
  updateUser,
  findUserByEmployeeId,
  getOfficeMaster,
  setOfficeMaster,
  listEmployeeMaster,
  getSettings,
  setSettings,
  bulkUpsertEmployeeMasterRows,
  upsertEmployeeMasterRow,
} from "../../../shared/services/firestoreApi";
import { writeAuditLog } from "../../../shared/services/functionsApi";
import { useAuthState } from "../../../shared/hooks/useAuthState";
import { useAuthCtx } from "../../auth/context/AuthContext";
import {
  arrayBufferToWorkbook,
  readFirstSheet,
  validateEmployeeRows,
  TEMPLATE_CONSTANTS,
} from "../../../shared/utils/excel";
import { cn, formatTimestamp, downloadBlob } from "../../../shared/utils/ui";
import type {
  FirestoreUser,
  OfficeMaster,
  AppSettings,
  EmployeeMasterRow,
} from "../../../shared/types/firestore";

type TabKey = "list" | "import" | "office";

type ValidatedRow = EmployeeMasterRow & {
  _rowIndex: number;
  _errors: string[];
  _valid: boolean;
};

interface EditableUser {
  uid: string;
  name: string;
  officeName: string;
  division: string;
  designation: string;
}

function Tabs({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (k: TabKey) => void;
}) {
  const items: Array<{ key: TabKey; label: string }> = [
    { key: "list", label: "List" },
    { key: "import", label: "Import Excel" },
    { key: "office", label: "Office Master" },
  ];
  return (
    <div className="bg-white rounded-lg border border-brand-100 shadow-sm">
      <div className="border-b border-brand-100">
        <nav className="flex gap-1 px-2">
          {items.map((item) => (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                active === item.key
                  ? "border-brand-600 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

function ChipInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const v = input.trim();
    if (!v) return;
    if (values.includes(v)) {
      setInput("");
      return;
    }
    onChange([...values, v]);
    setInput("");
  };

  const remove = (idx: number) => {
    onChange(values.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}
      </label>
      <div className="flex flex-wrap gap-2 mb-2 min-h-[36px] items-center">
        {values.length === 0 && (
          <span className="text-sm text-slate-400 italic">No entries yet</span>
        )}
        {values.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-50 text-slate-700 text-sm"
          >
            {v}
            <button
              onClick={() => remove(i)}
              className="text-slate-400 hover:text-rose-600 ml-1"
              type="button"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder ?? "Type and press Enter"}
          className="flex-1 px-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500"
        />
        <button
          type="button"
          onClick={add}
          className="px-4 py-2 rounded-md bg-brand-50 text-slate-700 text-sm font-medium hover:bg-slate-200"
        >
          Add
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Enter one per line by pressing Enter. Click × on a chip to remove.
      </p>
    </div>
  );
}

export default function EmployeeMasterPage() {
  const { dbUser } = useAuthState();
  const { adminIdentity } = useAuthCtx();
  const [tab, setTab] = useState<TabKey>("list");

  const [users, setUsers] = useState<FirestoreUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [officeMaster, setOfficeMasterState] = useState<OfficeMaster>({
    divisions: [],
    offices: [],
    designations: [],
  });
  const [officeLoading, setOfficeLoading] = useState(true);
  const [settings, setSettingsState] = useState<AppSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [empMaster, setEmpMaster] = useState<
    Array<{ id: string } & Record<string, unknown>>
  >([]);
  const [empMasterLoading, setEmpMasterLoading] = useState(true);

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .finally(() => setUsersLoading(false));
    getOfficeMaster()
      .then((m) =>
        setOfficeMasterState(
          m ?? { divisions: [], offices: [], designations: [] }
        )
      )
      .finally(() => setOfficeLoading(false));
    getSettings()
      .then((s) => setSettingsState(s))
      .finally(() => setSettingsLoading(false));
    listEmployeeMaster()
      .then(setEmpMaster)
      .finally(() => setEmpMasterLoading(false));
  }, [tab]);

  const employees = useMemo(
    () => users.filter((u) => u.role === "employee"),
    [users]
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Employee Master
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage employees, bulk import, and configure office / division /
            designation master lists.
          </p>
        </div>

        <Tabs active={tab} onChange={setTab} />

        {tab === "list" && (
          <ListTab
            employees={employees}
            employeesLoading={usersLoading}
            officeMaster={officeMaster}
            onRefresh={() => {
              setUsersLoading(true);
              listUsers()
                .then(setUsers)
                .finally(() => setUsersLoading(false));
            }}
            dbUserUid={adminIdentity?.uid ?? dbUser?.uid ?? ""}
            dbUserEmail={adminIdentity?.email ?? dbUser?.email}
          />
        )}

        {tab === "import" && (
          <ImportTab
            settings={settings}
            settingsLoading={settingsLoading}
            officeMaster={officeMaster}
            empMaster={empMaster}
            empMasterLoading={empMasterLoading}
            onEnableMasterListMode={async () => {
              const next: AppSettings = {
                ...(settings ?? {}),
                masterListMode: true,
              } as AppSettings;
              await setSettings(next);
              setSettingsState(next);
              await writeAuditLog({
                action: "settings.update",
                adminUid: dbUser?.uid ?? "",
                adminEmail: dbUser?.email,
                payload: { masterListMode: true },
              });
            }}
            onDone={async () => {
              setEmpMasterLoading(true);
              setUsersLoading(true);
              await Promise.all([
                listEmployeeMaster().then(setEmpMaster),
                listUsers().then(setUsers),
                getSettings().then(setSettingsState),
              ]);
              setEmpMasterLoading(false);
              setUsersLoading(false);
            }}
            dbUserUid={adminIdentity?.uid ?? dbUser?.uid ?? ""}
            dbUserEmail={adminIdentity?.email ?? dbUser?.email}
          />
        )}

        {tab === "office" && (
          <OfficeMasterTab
            officeMaster={officeMaster}
            loading={officeLoading}
            onSaved={() => {
              setOfficeLoading(true);
              getOfficeMaster()
                .then((m) =>
                  setOfficeMasterState(
                    m ?? { divisions: [], offices: [], designations: [] }
                  )
                )
                .finally(() => setOfficeLoading(false));
            }}
            dbUserUid={adminIdentity?.uid ?? dbUser?.uid ?? ""}
            dbUserEmail={adminIdentity?.email ?? dbUser?.email}
          />
        )}
      </div>
    </AdminLayout>
  );
}

function ListTab({
  employees,
  employeesLoading,
  officeMaster,
  onRefresh,
  dbUserUid,
  dbUserEmail,
}: {
  employees: FirestoreUser[];
  employeesLoading: boolean;
  officeMaster: OfficeMaster;
  onRefresh: () => void;
  dbUserUid: string;
  dbUserEmail?: string;
}) {
  const [filterName, setFilterName] = useState("");
  const [filterOffice, setFilterOffice] = useState("");
  const [filterDivision, setFilterDivision] = useState("");
  const [editing, setEditing] = useState<Record<string, EditableUser>>({});
  const [savingUid, setSavingUid] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return employees.filter((u) => {
      if (filterName) {
        const hay = `${u.name ?? ""} ${u.displayName ?? ""} ${
          u.employeeId ?? ""
        }`.toLowerCase();
        if (!hay.includes(filterName.toLowerCase())) return false;
      }
      if (filterOffice && (u.officeName ?? "") !== filterOffice) return false;
      if (filterDivision && (u.division ?? "") !== filterDivision) return false;
      return true;
    });
  }, [employees, filterName, filterOffice, filterDivision]);

  const startEdit = (u: FirestoreUser) => {
    setEditing((e) => ({
      ...e,
      [u.uid]: {
        uid: u.uid,
        name: u.name ?? u.displayName ?? "",
        officeName: u.officeName ?? "",
        division: u.division ?? "",
        designation: u.designation ?? "",
      },
    }));
  };

  const cancelEdit = (uid: string) => {
    setEditing((e) => {
      const n = { ...e };
      delete n[uid];
      return n;
    });
  };

  const saveEdit = async (u: FirestoreUser) => {
    const draft = editing[u.uid];
    if (!draft || savingUid) return;
    setSavingUid(u.uid);
    try {
      await updateUser(u.uid, {
        name: draft.name,
        displayName: draft.name,
        officeName: draft.officeName,
        division: draft.division,
        designation: draft.designation,
      });
      await upsertEmployeeMasterRow({
        employeeId: u.employeeId ?? u.uid,
        name: draft.name,
        officeName: draft.officeName,
        division: draft.division,
        designation: draft.designation,
      });
      await writeAuditLog({
        action: "employee.edit",
        adminUid: dbUserUid,
        adminEmail: dbUserEmail,
        payload: {
          employeeId: u.employeeId,
          uid: u.uid,
          changes: draft,
        },
      });
      cancelEdit(u.uid);
      onRefresh();
    } finally {
      setSavingUid(null);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-brand-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-brand-100 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-slate-900">
            Employees ({employees.length})
          </h2>
          <span className="ml-auto text-xs text-slate-500">
            {employeesLoading ? "Loading..." : `Showing ${filtered.length}`}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Filter by name / ID..."
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            className="px-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500"
          />
          <select
            value={filterOffice}
            onChange={(e) => setFilterOffice(e.target.value)}
            className="px-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500"
          >
            <option value="">All Offices</option>
            {officeMaster.offices.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <select
            value={filterDivision}
            onChange={(e) => setFilterDivision(e.target.value)}
            className="px-3 py-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500"
          >
            <option value="">All Divisions</option>
            {officeMaster.divisions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brand-50 text-slate-500 text-left sticky top-0">
            <tr>
              <th className="px-5 py-3 font-medium">Employee ID</th>
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-5 py-3 font-medium">Office</th>
              <th className="px-5 py-3 font-medium">Division</th>
              <th className="px-5 py-3 font-medium">Designation</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Created</th>
              <th className="px-5 py-3 font-medium w-28"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {employeesLoading ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-slate-400">
                  <div className="inline-flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-brand-100 border-t-slate-700" />
                    Loading employees...
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-slate-400">
                  No employees found
                </td>
              </tr>
            ) : (
              filtered.map((u) => {
                const draft = editing[u.uid];
                const isEditing = !!draft;
                const isSaving = savingUid === u.uid;
                return (
                  <tr key={u.uid} className="hover:bg-brand-50">
                    <td className="px-5 py-3 font-mono text-xs">
                      {u.employeeId ?? <span className="text-slate-400">-</span>}
                    </td>
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <input
                          className="w-full px-2 py-1 rounded border border-slate-300 text-sm"
                          value={draft!.name}
                          onChange={(e) =>
                            setEditing((ed) => ({
                              ...ed,
                              [u.uid]: { ...ed[u.uid]!, name: e.target.value },
                            }))
                          }
                        />
                      ) : (
                        <span className="font-medium text-slate-900">
                          {u.name ?? u.displayName ?? "-"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <input
                          className="w-full px-2 py-1 rounded border border-slate-300 text-sm"
                          value={draft!.officeName}
                          onChange={(e) =>
                            setEditing((ed) => ({
                              ...ed,
                              [u.uid]: {
                                ...ed[u.uid]!,
                                officeName: e.target.value,
                              },
                            }))
                          }
                        />
                      ) : (
                        u.officeName ?? "-"
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <input
                          className="w-full px-2 py-1 rounded border border-slate-300 text-sm"
                          value={draft!.division}
                          onChange={(e) =>
                            setEditing((ed) => ({
                              ...ed,
                              [u.uid]: {
                                ...ed[u.uid]!,
                                division: e.target.value,
                              },
                            }))
                          }
                        />
                      ) : (
                        u.division ?? "-"
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {isEditing ? (
                        <input
                          className="w-full px-2 py-1 rounded border border-slate-300 text-sm"
                          value={draft!.designation}
                          onChange={(e) =>
                            setEditing((ed) => ({
                              ...ed,
                              [u.uid]: {
                                ...ed[u.uid]!,
                                designation: e.target.value,
                              },
                            }))
                          }
                        />
                      ) : (
                        u.designation ?? "-"
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {u.role}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {formatTimestamp(u.createdAt)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {isEditing ? (
                        <div className="inline-flex gap-1.5">
                          <button
                            onClick={() => saveEdit(u)}
                            disabled={isSaving}
                            className="px-3 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {isSaving ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={() => cancelEdit(u.uid)}
                            disabled={isSaving}
                            className="px-3 py-1.5 rounded-md border border-brand-100 text-slate-600 text-xs font-medium hover:bg-brand-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(u)}
                          className="px-3 py-1.5 rounded-md border border-brand-100 text-slate-600 text-xs font-medium hover:bg-brand-50"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImportTab({
  settings,
  settingsLoading,
  officeMaster,
  empMaster,
  empMasterLoading,
  onEnableMasterListMode,
  onDone,
  dbUserUid,
  dbUserEmail,
}: {
  settings: AppSettings | null;
  settingsLoading: boolean;
  officeMaster: OfficeMaster;
  empMaster: Array<{ id: string } & Record<string, unknown>>;
  empMasterLoading: boolean;
  onEnableMasterListMode: () => Promise<void>;
  onDone: () => Promise<void>;
  dbUserUid: string;
  dbUserEmail?: string;
}) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ValidatedRow[]>([]);
  const [parsed, setParsed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [enablingMaster, setEnablingMaster] = useState(false);

  const stats = useMemo(() => {
    const total = rows.length;
    const invalid = rows.filter((r) => !r._valid).length;
    const valid = total - invalid;
    return { total, valid, invalid };
  }, [rows]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    setSuccess("");
    setParsed(false);
    try {
      const buf = await file.arrayBuffer();
      const wb = arrayBufferToWorkbook(buf);
      const raw = readFirstSheet<Record<string, unknown>>(wb);
      const validated = validateEmployeeRows(
        raw as (Record<string, unknown> & EmployeeMasterRow)[]
      );
      setRows(validated);
      setParsed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    }
  };

  const handleDownloadTemplate = () => {
    const headers = TEMPLATE_CONSTANTS.EMPLOYEE_HEADERS;
    const sample: string[][] = [
      headers,
      ["E001", "John Doe", "Head Office", "Sales", "Manager"],
      ["E002", "Jane Smith", "Branch A", "Engineering", "Engineer"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, "Employee_Master_Template.xlsx");
  };

  const handleUpsert = async () => {
    const validRows = rows.filter((r) => r._valid);
    if (validRows.length === 0) {
      setError("No valid rows to import");
      return;
    }
    setImporting(true);
    setError("");
    setSuccess("");
    try {
      const masterRows = validRows.map((r) => {
        const raw = r as unknown as Record<string, unknown>;
        return {
          employeeId: String(raw["Employee ID"] ?? r.employeeId).trim(),
          name: String(raw["Name"] ?? r.name).trim(),
          officeName: String(raw["Office Name"] ?? r.officeName).trim(),
          division: String(raw["Division"] ?? r.division).trim(),
          designation: String(raw["Designation"] ?? r.designation).trim(),
        };
      });

      await bulkUpsertEmployeeMasterRows(masterRows);

      let updatedUsers = 0;
      for (const row of masterRows) {
        const existingUser = await findUserByEmployeeId(row.employeeId);
        if (existingUser) {
          await updateUser(existingUser.uid, {
            name: row.name,
            displayName: row.name,
            officeName: row.officeName,
            division: row.division,
            designation: row.designation,
          });
          updatedUsers += 1;
        }
      }

      await writeAuditLog({
        action: "employee.import",
        adminUid: dbUserUid,
        adminEmail: dbUserEmail,
        payload: {
          count: masterRows.length,
          updatedUsers,
          invalid: stats.invalid,
        },
      });

      setSuccess(
        `Successfully upserted ${masterRows.length} employee master rows. ${updatedUsers} existing user record(s) updated.`
      );
      await onDone();
      setRows([]);
      setParsed(false);
      setFileName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {!settingsLoading && settings && !settings.masterListMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-amber-900">
              Master List Mode is disabled
            </h3>
            <p className="text-sm text-amber-800 mt-1">
              Employees must be present in the master list to log in. Enable
              Master List Mode to enforce this check.
            </p>
          </div>
          <button
            onClick={async () => {
              setEnablingMaster(true);
              try {
                await onEnableMasterListMode();
              } finally {
                setEnablingMaster(false);
              }
            }}
            disabled={enablingMaster}
            className="px-4 py-2 rounded-md bg-amber-700 text-white text-sm font-medium hover:bg-amber-800 disabled:opacity-50 whitespace-nowrap"
          >
            {enablingMaster ? "Enabling..." : "Enable Master List Mode"}
          </button>
        </div>
      )}

      <section className="bg-white rounded-lg border border-brand-100 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-base font-semibold text-slate-900 mb-1">
              Step 1: Download Template &amp; Choose File
            </h2>
            <p className="text-sm text-slate-500">
              First download the template, fill it in, then upload the .xlsx
              file.
            </p>
          </div>
          <button
            onClick={handleDownloadTemplate}
            className="px-4 py-2 rounded-md bg-brand-700 text-white text-sm font-medium hover:bg-brand-700 whitespace-nowrap"
          >
            Download Employee Template
          </button>
        </div>
        <div className="mt-4">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-brand-700 file:text-white hover:file:bg-brand-600"
          />
          {fileName && (
            <p className="mt-2 text-sm text-slate-500">Selected: {fileName}</p>
          )}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          {success && (
            <p className="mt-2 text-sm text-emerald-700 font-medium">
              {success}
            </p>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-slate-500">
          <div className="rounded-md bg-brand-50 border border-brand-100 p-3">
            <div className="font-semibold text-slate-700">
              Master list rows
            </div>
            <div className="mt-1 text-lg text-slate-900">
              {empMasterLoading ? "..." : empMaster.length}
            </div>
          </div>
          <div className="rounded-md bg-brand-50 border border-brand-100 p-3">
            <div className="font-semibold text-slate-700">Offices</div>
            <div className="mt-1 text-lg text-slate-900">
              {officeMaster.offices.length}
            </div>
          </div>
          <div className="rounded-md bg-brand-50 border border-brand-100 p-3">
            <div className="font-semibold text-slate-700">Divisions</div>
            <div className="mt-1 text-lg text-slate-900">
              {officeMaster.divisions.length}
            </div>
          </div>
        </div>
      </section>

      {parsed && (
        <section className="bg-white rounded-lg border border-brand-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-brand-100">
            <h2 className="text-base font-semibold text-slate-900 mb-2">
              Step 2: Preview &amp; Validation
            </h2>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span className="text-slate-600">
                Total rows:{" "}
                <strong className="text-slate-900">{stats.total}</strong>
              </span>
              <span className="text-slate-600">
                Valid:{" "}
                <strong className="text-emerald-700">{stats.valid}</strong>
              </span>
              <span className="text-slate-600">
                Invalid:{" "}
                <strong className="text-red-700">{stats.invalid}</strong>
              </span>
              {stats.invalid > 0 && (
                <span className="text-red-600 font-medium">
                  Rows highlighted in red will be skipped.
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-50 text-slate-500 text-left sticky top-0">
                <tr>
                  <th className="px-4 py-3 font-medium w-12">#</th>
                  <th className="px-4 py-3 font-medium">Employee ID</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Office Name</th>
                  <th className="px-4 py-3 font-medium">Division</th>
                  <th className="px-4 py-3 font-medium">Designation</th>
                  <th className="px-4 py-3 font-medium min-w-[200px]">
                    Errors
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {rows.map((row, i) => {
                  const raw = row as unknown as Record<string, unknown>;
                  return (
                    <tr
                      key={i}
                      className={cn(!row._valid && "bg-red-50 text-red-800")}
                    >
                      <td className="px-4 py-3 align-top">{i + 1}</td>
                      <td className="px-4 py-3 align-top font-mono text-xs">
                        {String(raw["Employee ID"] ?? row.employeeId ?? "")}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {String(raw["Name"] ?? row.name ?? "")}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {String(raw["Office Name"] ?? row.officeName ?? "")}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {String(raw["Division"] ?? row.division ?? "")}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {String(raw["Designation"] ?? row.designation ?? "")}
                      </td>
                      <td className="px-4 py-3 align-top text-red-700">
                        {row._errors?.join(" | ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {parsed && (
        <section className="bg-white rounded-lg border border-brand-100 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 mb-3">
            Step 3: Upsert Master List
          </h2>
          <p className="text-sm text-slate-500 mb-4">
            Valid rows will be written to the <code>employeeMaster</code>{" "}
            collection. If a user already exists with the same Employee ID,
            their profile will also be updated.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleUpsert}
              disabled={importing || stats.valid === 0}
              className="px-5 py-2.5 rounded-md bg-brand-700 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing
                ? "Upserting..."
                : `Upsert Master list (${stats.valid} valid)`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function OfficeMasterTab({
  officeMaster,
  loading,
  onSaved,
  dbUserUid,
  dbUserEmail,
}: {
  officeMaster: OfficeMaster;
  loading: boolean;
  onSaved: () => void;
  dbUserUid: string;
  dbUserEmail?: string;
}) {
  const [divisions, setDivisions] = useState<string[]>([]);
  const [offices, setOffices] = useState<string[]>([]);
  const [designations, setDesignations] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDivisions(officeMaster.divisions ?? []);
    setOffices(officeMaster.offices ?? []);
    setDesignations(officeMaster.designations ?? []);
    setDirty(false);
  }, [officeMaster]);

  const changed =
    JSON.stringify(divisions) !== JSON.stringify(officeMaster.divisions) ||
    JSON.stringify(offices) !== JSON.stringify(officeMaster.offices) ||
    JSON.stringify(designations) !==
      JSON.stringify(officeMaster.designations);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const next: OfficeMaster = {
        id: officeMaster.id ?? "main",
        divisions,
        offices,
        designations,
      };
      await setOfficeMaster(next);
      await writeAuditLog({
        action: "settings.update",
        adminUid: dbUserUid,
        adminEmail: dbUserEmail,
        payload: {
          officeMaster: next,
        },
      });
      setSuccess("Office master saved successfully.");
      setDirty(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white rounded-lg border border-brand-100 p-5 shadow-sm">
      <div className="mb-6">
        <h2 className="text-base font-semibold text-slate-900">
          Configure Office / Division / Designation
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          These lists appear as dropdown options in forms, filters, and
          validation during employee import.
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <div className="inline-flex items-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-brand-100 border-t-slate-700" />
            Loading office master...
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <ChipInput
            label="Divisions"
            values={divisions}
            onChange={(v) => {
              setDivisions(v);
              setDirty(true);
            }}
            placeholder="e.g. Sales, Engineering, HR"
          />
          <ChipInput
            label="Offices"
            values={offices}
            onChange={(v) => {
              setOffices(v);
              setDirty(true);
            }}
            placeholder="e.g. Head Office, Branch A, Remote"
          />
          <ChipInput
            label="Designations"
            values={designations}
            onChange={(v) => {
              setDesignations(v);
              setDirty(true);
            }}
            placeholder="e.g. Manager, Engineer, Executive"
          />

          <div className="pt-4 border-t border-brand-100 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !changed}
              className="px-5 py-2.5 rounded-md bg-brand-700 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Office Master"}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && !changed && (
              <p className="text-sm text-emerald-700 font-medium">{success}</p>
            )}
            {dirty && !success && (
              <p className="text-sm text-amber-600">
                You have unsaved changes.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
