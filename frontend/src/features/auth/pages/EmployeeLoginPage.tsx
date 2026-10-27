import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import {
  useAuthCtx,
  EMPLOYEE_ID_PATTERN,
  DEFAULT_EMPLOYEE_PASSWORD,
  DIVISION_OPTIONS,
} from "../context/AuthContext";
import { cn } from "../../../shared/utils/ui";
import { IndiaPostEmblem } from "../../../shared/components/IndiaPostEmblem";

/** Background artwork per onboarding step, rendered at low opacity. */
const LOGIN_BACKGROUNDS: Record<1 | 2, string> = {
  1: "/images/cbero1.webp",
  2: "/images/cbero2.webp",
};

const credentialsSchema = z.object({
  employeeId: z
    .string()
    .regex(EMPLOYEE_ID_PATTERN, "Employee ID must be exactly 8 digits"),
  password: z.string().min(1, "Password is required"),
});

const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  officeName: z.string().min(2, "Office Name must be at least 2 characters"),
  division: z.string().min(1, "Division is required"),
  designation: z.string().min(2, "Designation must be at least 2 characters"),
});

type CredentialsFormData = z.infer<typeof credentialsSchema>;
type ProfileFormData = z.infer<typeof profileSchema>;

const inputClass = (hasError: boolean) =>
  cn(
    "w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-transparent",
    hasError ? "border-red-300 bg-red-50" : "border-slate-300 bg-white"
  );

export function EmployeeLoginPage() {
  const navigate = useNavigate();
  const {
    verifyEmployeeCredentials,
    saveEmployeeProfile,
    setEmployeeIdentity,
    loginError,
    loading: authLoading,
  } = useAuthCtx();

  const [step, setStep] = useState<1 | 2>(1);
  const [verifiedId, setVerifiedId] = useState("");

  const credentialsForm = useForm<CredentialsFormData>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { employeeId: "", password: "" },
  });

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", officeName: "", division: "", designation: "" },
  });

  const loading = authLoading || credentialsForm.formState.isSubmitting;

  const onCredentialsSubmit = async (data: CredentialsFormData) => {
    const result = await verifyEmployeeCredentials(data.employeeId, data.password);
    if (!result.ok) return;

    if (result.profile) {
      // Profile already stored in Firebase — skip the details step.
      setEmployeeIdentity(result.profile);
      navigate("/employee/home", { replace: true });
      return;
    }

    setVerifiedId(data.employeeId.trim());
    setStep(2);
  };

  const onProfileSubmit = async (data: ProfileFormData) => {
    const result = await saveEmployeeProfile({ employeeId: verifiedId, ...data });
    if (result.ok) {
      navigate("/employee/home", { replace: true });
    }
  };

  const stepTwoLoading = authLoading || profileForm.formState.isSubmitting;

  return (
    <div className="relative min-h-screen flex flex-col bg-slate-100">
      <img
        src={LOGIN_BACKGROUNDS[step]}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20"
      />
      <div className="relative z-10 postal-stripe h-1.5 shrink-0" />
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-white rounded-lg shadow-lg border border-brand-100">
          <div className="px-6 py-5 border-b border-brand-100">
            <div className="flex items-center gap-3">
              <IndiaPostEmblem className="h-10 w-10 shrink-0" />
              <div className="min-w-0">
                <h1 className="text-base font-semibold text-slate-900 leading-tight">
                  Department of Posts
                </h1>
                <p className="text-sm font-medium text-brand-600 leading-tight">
                  Western Region, Coimbatore
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              {step === 1
                ? "Enter your Employee ID and password"
                : "Confirm your details"}
            </p>
          </div>

        {loginError && (
          <div className="mx-6 mt-4 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {loginError}
          </div>
        )}

        {step === 1 ? (
          <form
            onSubmit={credentialsForm.handleSubmit(onCredentialsSubmit)}
            className="px-6 py-5 space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Employee ID
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                {...credentialsForm.register("employeeId")}
                disabled={loading}
                className={inputClass(!!credentialsForm.formState.errors.employeeId)}
                placeholder="8-digit Employee ID"
              />
              {credentialsForm.formState.errors.employeeId ? (
                <p className="mt-1 text-xs text-red-600">
                  {credentialsForm.formState.errors.employeeId.message}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">8 digits, e.g. 12345678</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                type="password"
                {...credentialsForm.register("password")}
                disabled={loading}
                autoComplete="current-password"
                className={inputClass(!!credentialsForm.formState.errors.password)}
                placeholder="Enter password"
              />
              {credentialsForm.formState.errors.password ? (
                <p className="mt-1 text-xs text-red-600">
                  {credentialsForm.formState.errors.password.message}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">
                  Default password: {DEFAULT_EMPLOYEE_PASSWORD}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Checking..." : "Continue"}
            </button>
          </form>
        ) : (
          <form
            onSubmit={profileForm.handleSubmit(onProfileSubmit)}
            className="px-6 py-5 space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Employee ID
              </label>
              <input
                type="text"
                value={verifiedId}
                readOnly
                disabled
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-slate-100 text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Name
              </label>
              <input
                type="text"
                {...profileForm.register("name")}
                disabled={stepTwoLoading}
                className={inputClass(!!profileForm.formState.errors.name)}
                placeholder="Sathish"
              />
              {profileForm.formState.errors.name && (
                <p className="mt-1 text-xs text-red-600">
                  {profileForm.formState.errors.name.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Office Name
              </label>
              <input
                type="text"
                {...profileForm.register("officeName")}
                disabled={stepTwoLoading}
                className={inputClass(!!profileForm.formState.errors.officeName)}
                placeholder="Coimbatore HO"
              />
              {profileForm.formState.errors.officeName && (
                <p className="mt-1 text-xs text-red-600">
                  {profileForm.formState.errors.officeName.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Division
              </label>
              <select
                {...profileForm.register("division")}
                disabled={stepTwoLoading}
                className={cn(
                  inputClass(!!profileForm.formState.errors.division),
                  "bg-white"
                )}
              >
                <option value="">Select division...</option>
                {DIVISION_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {profileForm.formState.errors.division && (
                <p className="mt-1 text-xs text-red-600">
                  {profileForm.formState.errors.division.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Designation
              </label>
              <input
                type="text"
                {...profileForm.register("designation")}
                disabled={stepTwoLoading}
                className={inputClass(!!profileForm.formState.errors.designation)}
                placeholder="Postal Assistant"
              />
              {profileForm.formState.errors.designation && (
                <p className="mt-1 text-xs text-red-600">
                  {profileForm.formState.errors.designation.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={stepTwoLoading}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-md hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {stepTwoLoading ? "Saving..." : "Save & continue"}
            </button>
          </form>
        )}
        </div>
      </div>
    </div>
  );
}
