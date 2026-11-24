"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Stethoscope,
  Building2,
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import VetRegisterForm from "@/components/vet/VetRegisterForm";
import BranchRegisterForm from "@/components/vet/BranchRegisterForm";

export default function VetRegisterPage() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<"vet" | "branch">("vet");
  const [successInfo, setSuccessInfo] = useState<{
    title: string;
    message: React.ReactNode;
  } | null>(null);

  const handleSuccess = (summary: {
    title: string;
    message: React.ReactNode;
  }) => {
    setSuccessInfo(summary);
    setTimeout(() => {
      router.push("/vet/login");
    }, 4000);
  };

  if (successInfo) {
    return (
      <main className="min-h-screen bg-petlight flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-100">
          <CheckCircle2 className="w-16 h-16 text-petgreen mx-auto mb-4" />
          <h2 className="text-xl font-bold text-petblue mb-2">
            {successInfo.title}
          </h2>
          <p className="text-slate-600 text-sm mb-4">{successInfo.message}</p>
          <p className="text-slate-500 text-xs">
            Redirigiendo al portal de acceso...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-petlight flex items-center justify-center p-4 overflow-x-hidden py-8">
      <div className="w-[90%] max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-petblue text-white p-8 text-center relative">
          <div className="absolute top-4 left-4">
            <Link
              href="/"
              className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-lg border border-white/10 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-white" />
            </Link>
          </div>

          <div className="absolute top-4 right-4">
            <span className="inline-flex items-center gap-1 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-mono tracking-wider text-petgreen border border-white/10">
              <ShieldAlert className="w-3 h-3 text-petgreen" />
              <span>Auditoría Estricta</span>
            </span>
          </div>

          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/10 shadow-inner">
            {accountType === "vet" ? (
              <Stethoscope className="w-7 h-7 text-petgreen" />
            ) : (
              <Building2 className="w-7 h-7 text-petgreen" />
            )}
          </div>

          <h1 className="text-xl font-bold tracking-tight text-white">
            {accountType === "vet" ? "Alta Profesional" : "Alta de Sucursal"}
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto">
            {accountType === "vet"
              ? "Registrá tu matrícula y elegí en qué sucursales trabajás."
              : "Registrá tu clínica y sucursal para operar mostrador y sala de espera."}
          </p>
        </div>

        <div className="px-6 sm:px-8 pt-6">
          <div className="grid grid-cols-2 gap-2 bg-petlight p-1.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setAccountType("vet")}
              className={`min-h-[42px] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                accountType === "vet"
                  ? "bg-petblue text-white shadow-sm"
                  : "text-slate-600 hover:text-petblue"
              }`}
            >
              <Stethoscope className="w-4 h-4 text-petgreen" />
              <span>Veterinario</span>
            </button>
            <button
              type="button"
              onClick={() => setAccountType("branch")}
              className={`min-h-[42px] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                accountType === "branch"
                  ? "bg-petblue text-white shadow-sm"
                  : "text-slate-600 hover:text-petblue"
              }`}
            >
              <Building2 className="w-4 h-4 text-petgreen" />
              <span>Sucursal</span>
            </button>
          </div>
        </div>

        <div className="p-6 sm:p-8 pt-5">
          {accountType === "vet" ? (
            <VetRegisterForm onSuccess={handleSuccess} />
          ) : (
            <BranchRegisterForm onSuccess={handleSuccess} />
          )}

          <div className="text-center pt-4">
            <p className="text-[13px] text-slate-600 font-medium">
              ¿Ya tenés cuenta aprobada?{" "}
              <Link
                href="/vet/login"
                className="text-petblue font-bold hover:underline"
              >
                Iniciá sesión aquí
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}