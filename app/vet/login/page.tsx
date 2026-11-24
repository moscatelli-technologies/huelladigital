"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Stethoscope,
  ShieldAlert,
  Lock,
  Mail,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function VetLoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [pendingInfo, setPendingInfo] = useState<{
    title: string;
    description: string;
  } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        });

      if (authError || !authData.user) {
        throw new Error(
          "Credenciales inválidas. Verifica tu correo y contraseña."
        );
      }

      const userId = authData.user.id;

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, branch_id, full_name")
        .eq("id", userId)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        throw new Error("No se encontró un perfil asociado a este usuario.");
      }

      const allowedRoles = ["reception", "vet", "clinic_admin", "owner"];
      if (!allowedRoles.includes(profile.role)) {
        await supabase.auth.signOut();
        throw new Error(
          "Esta cuenta no tiene permisos de acceso al Portal Clínico."
        );
      }

      // Veterinario: validar matrícula aprobada y sucursales asociadas
      if (profile.role === "vet") {
        const { data: vetProfile, error: vetError } = await supabase
          .from("vet_profiles")
          .select("status, branch_id")
          .eq("id", userId)
          .single();

        if (vetError || !vetProfile) {
          await supabase.auth.signOut();
          throw new Error(
            "No se encontró un perfil profesional veterinario asociado a este usuario."
          );
        }

        if (vetProfile.status === "pending") {
          await supabase.auth.signOut();
          setPendingInfo({
            title: "Validación Profesional en Proceso",
            description:
              "Tu perfil profesional y tus sucursales seleccionadas están en proceso de verificación por el equipo de HuellaDigital.",
          });
          return;
        }

        if (vetProfile.status !== "approved") {
          await supabase.auth.signOut();
          throw new Error(
            "Tu perfil profesional ha sido rechazado o inhabilitado."
          );
        }

        const { data: linkedBranches } = await supabase
          .from("vet_branches")
          .select("branch_id")
          .eq("vet_id", userId);

        const hasBranch =
          (linkedBranches && linkedBranches.length > 0) ||
          Boolean(vetProfile.branch_id || profile.branch_id);

        if (!hasBranch) {
          await supabase.auth.signOut();
          throw new Error(
            "Tu cuenta veterinaria aún no tiene una sucursal clínica asignada."
          );
        }

        router.push("/vet/dashboard");
        return;
      }

      // Recepción dedicada
      if (profile.role === "reception") {
        if (!profile.branch_id) {
          await supabase.auth.signOut();
          throw new Error(
            "Tu usuario de recepción aún no tiene una sucursal asignada."
          );
        }
        router.push("/vet/reception");
        return;
      }

      // Cuenta de Sucursal (clinic_admin u owner): verificar habilitación de sucursal
      if (!profile.branch_id) {
        await supabase.auth.signOut();
        throw new Error(
          "Esta cuenta de sucursal aún no tiene una sucursal asignada."
        );
      }

      const { data: branchData, error: branchError } = await supabase
        .from("clinic_branches")
        .select("is_active")
        .eq("id", profile.branch_id)
        .single();

      if (branchError || !branchData) {
        await supabase.auth.signOut();
        throw new Error("No se encontró la sucursal asociada a esta cuenta.");
      }

      if (!branchData.is_active && profile.role === "clinic_admin") {
        await supabase.auth.signOut();
        setPendingInfo({
          title: "Sucursal en Proceso de Habilitación",
          description:
            "El alta de tu sucursal está siendo auditada por HuellaDigital. Te avisaremos cuando quede activa para operar en mostrador.",
        });
        return;
      }

      router.push("/vet/reception");
    } catch (error: any) {
      setErrorMessage(error.message || "Ocurrió un error al intentar acceder.");
    } finally {
      setIsLoading(false);
    }
  };

  if (pendingInfo) {
    return (
      <main className="min-h-screen bg-petlight flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-100 relative">
          <ShieldAlert className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-pulse" />
          <h2 className="text-xl font-bold text-petblue mb-2">
            {pendingInfo.title}
          </h2>
          <p className="text-slate-600 text-sm">{pendingInfo.description}</p>
          <p className="text-slate-500 text-xs mt-4">
            Una vez habilitada tu cuenta, podrás acceder con tu correo y
            contraseña.
          </p>
          <button
            type="button"
            onClick={() => setPendingInfo(null)}
            className="mt-6 text-sm text-petgreen font-bold hover:underline"
          >
            Volver al inicio de sesión
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-petlight flex items-center justify-center p-4 overflow-x-hidden">
      <div className="w-[90%] max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-petblue text-white p-8 text-center relative">
          <div className="absolute top-4 left-4">
            <Link
              href="/"
              className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-lg border border-white/10 transition-colors"
              aria-label="Volver al inicio"
            >
              <ArrowLeft className="w-4 h-4 text-white" />
            </Link>
          </div>

          <div className="absolute top-4 right-4">
            <span className="inline-flex items-center gap-1 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-mono tracking-wider text-petgreen border border-white/10">
              <ShieldAlert className="w-3 h-3 text-petgreen" />
              <span>Acceso Restringido</span>
            </span>
          </div>

          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/10 shadow-inner">
            <Stethoscope className="w-7 h-7 text-petgreen" />
          </div>

          <h1 className="text-xl font-bold tracking-tight text-white">
            Portal Clínico Veterinario
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto">
            Acceso para Veterinarios y Cuentas de Sucursal / Mostrador •
            Misiones
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-4">
          {errorMessage && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs font-medium border border-red-100 text-center">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Correo de Acceso <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-5 h-5" />
              </span>
              <input
                type="email"
                name="email"
                required
                placeholder="correo@clinica.com"
                value={credentials.email}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2 min-h-[44px] text-base bg-petlight border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-petgreen text-petblue font-medium placeholder-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Contraseña <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-5 h-5" />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                required
                placeholder="••••••••"
                value={credentials.password}
                onChange={handleChange}
                className="w-full pl-10 pr-12 py-2 min-h-[44px] text-base bg-petlight border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-petgreen text-petblue font-medium placeholder-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-petgreen transition-colors p-1"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div className="pt-3">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-petblue hover:bg-[#0b1f33] text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-petblue/20 transition-all active:scale-[0.98] disabled:opacity-70 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-petgreen" />
                  <span>Verificando Credenciales...</span>
                </>
              ) : (
                <>
                  <span>Acceder al Sistema Clínico</span>
                  <ArrowRight className="w-4 h-4 text-petgreen" />
                </>
              )}
            </button>
          </div>

          <div className="text-center pt-2">
            <p className="text-[13px] text-slate-600 font-medium">
              ¿No tenés cuenta?{" "}
              <Link
                href="/vet/register"
                className="text-petgreen font-bold hover:underline"
              >
                Solicitá alta de veterinario o sucursal
              </Link>
            </p>
          </div>
        </form>

        <div className="py-4 px-6 bg-slate-50/80 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400 font-medium">
            HuellaDigital • Módulo Clínico Multiusuario
          </p>
        </div>
      </div>
    </main>
  );
}