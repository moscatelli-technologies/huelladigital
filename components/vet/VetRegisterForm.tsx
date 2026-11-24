"use client";

import React, { useState, useEffect } from "react";
import {
  Lock,
  Mail,
  Award,
  User,
  Loader2,
  ArrowRight,
  CreditCard,
  Eye,
  EyeOff,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface ActiveBranchOption {
  id: string;
  name: string;
  city: string;
  clinicName: string;
}

interface VetRegisterFormProps {
  onSuccess: (summary: { title: string; message: React.ReactNode }) => void;
}

export default function VetRegisterForm({ onSuccess }: VetRegisterFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [activeBranches, setActiveBranches] = useState<ActiveBranchOption[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);

  const [vetForm, setVetForm] = useState({
    fullName: "",
    dni: "",
    licenseNumber: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    async function loadActiveBranches() {
      try {
        const { data, error } = await supabase
          .from("clinic_branches")
          .select("id, name, city, clinics(name)")
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (!error && data) {
          const mapped: ActiveBranchOption[] = data.map((b: any) => {
            const clinicObj = Array.isArray(b.clinics)
              ? b.clinics[0]
              : b.clinics;
            return {
              id: b.id,
              name: b.name,
              city: b.city || "Misiones",
              clinicName: clinicObj?.name || "Clínica",
            };
          });
          setActiveBranches(mapped);
        }
      } catch (err) {
        console.error("Error cargando sucursales activas:", err);
      } finally {
        setLoadingBranches(false);
      }
    }

    loadActiveBranches();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVetForm({
      ...vetForm,
      [e.target.name]: e.target.value,
    });
  };

  const toggleBranchSelection = (branchId: string) => {
    setSelectedBranchIds((prev) =>
      prev.includes(branchId)
        ? prev.filter((id) => id !== branchId)
        : [...prev, branchId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (vetForm.password !== vetForm.confirmPassword) {
        throw new Error(
          "Las contraseñas no coinciden. Verifícalas e intenta nuevamente."
        );
      }

      if (activeBranches.length > 0 && selectedBranchIds.length === 0) {
        throw new Error(
          "Seleccioná al menos una sucursal en la que vas a trabajar."
        );
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: vetForm.email,
        password: vetForm.password,
      });

      if (authError) throw new Error(authError.message);
      if (!authData.user) throw new Error("No se pudo crear el usuario.");

      const userId = authData.user.id;
      const primaryBranchId = selectedBranchIds[0] || null;

      const { error: profileError } = await supabase.from("profiles").upsert([
        {
          id: userId,
          full_name: vetForm.fullName.trim(),
          dni: vetForm.dni,
          role: "vet",
          branch_id: primaryBranchId,
          location: "Misiones, Argentina",
        },
      ]);

      if (profileError) {
        if (profileError.code === "23505") {
          throw new Error("Este DNI ya se encuentra registrado en el sistema.");
        }
        throw new Error(
          "Fallo al crear el perfil maestro: " + profileError.message
        );
      }

      const { error: vetError } = await supabase.from("vet_profiles").insert([
        {
          id: userId,
          license_number: vetForm.licenseNumber.trim(),
          branch_id: primaryBranchId,
          status: "pending",
        },
      ]);

      if (vetError) {
        throw new Error("Fallo al registrar matrícula: " + vetError.message);
      }

      if (selectedBranchIds.length > 0) {
        const branchRows = selectedBranchIds.map((bId) => ({
          vet_id: userId,
          branch_id: bId,
        }));

        const { error: vetBranchesError } = await supabase
          .from("vet_branches")
          .insert(branchRows);

        if (vetBranchesError) {
          throw new Error(
            "Fallo al asociar sucursales al veterinario: " +
              vetBranchesError.message
          );
        }
      }

      onSuccess({
        title: "¡Solicitud Enviada!",
        message: (
          <>
            Tu cuenta ha sido creada exitosamente. Tu matrícula{" "}
            <strong>{vetForm.licenseNumber}</strong>
            {selectedBranchIds.length > 0 && (
              <>
                {" "}
                y tus <strong>{selectedBranchIds.length}</strong> sucursal(es)
                seleccionada(s)
              </>
            )}{" "}
            quedaron en{" "}
            <span className="font-bold text-yellow-600">
              Validación Pendiente
            </span>
            .
          </>
        ),
      });
    } catch (error: any) {
      setErrorMessage(error.message || "Ocurrió un error en el registro.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs font-medium border border-red-100 text-center">
          {errorMessage}
        </div>
      )}

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
          Nombre Completo <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <User className="w-5 h-5" />
          </span>
          <input
            type="text"
            name="fullName"
            required
            placeholder="Dr. Juan Pérez"
            value={vetForm.fullName}
            onChange={handleChange}
            className="w-full pl-10 pr-4 py-2 min-h-[44px] text-base bg-petlight border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-petgreen text-petblue font-medium placeholder-slate-400"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
          DNI (Sin puntos) <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <CreditCard className="w-5 h-5" />
          </span>
          <input
            type="text"
            name="dni"
            required
            placeholder="Ej. 12345678"
            value={vetForm.dni}
            onChange={(e) =>
              setVetForm({
                ...vetForm,
                dni: e.target.value.replace(/\D/g, ""),
              })
            }
            className="w-full pl-10 pr-4 py-2 min-h-[44px] text-base bg-petlight border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-petgreen text-petblue font-medium placeholder-slate-400"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
          Matrícula Profesional <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Award className="w-5 h-5" />
          </span>
          <input
            type="text"
            name="licenseNumber"
            required
            placeholder="Ej. MP Nº 1234"
            value={vetForm.licenseNumber}
            onChange={handleChange}
            className="w-full pl-10 pr-4 py-2 min-h-[44px] text-base bg-petlight border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-petgreen text-petblue font-medium placeholder-slate-400"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
          Sucursales en las que trabajás{" "}
          {activeBranches.length > 0 && <span className="text-red-500">*</span>}
        </label>
        {loadingBranches ? (
          <div className="p-3 bg-petlight border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-petgreen" />
            <span>Cargando sucursales habilitadas...</span>
          </div>
        ) : activeBranches.length === 0 ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            No hay sucursales activas listadas todavía. Podés enviar tu
            solicitud y coordinar tu sucursal con administración.
          </div>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto bg-petlight p-2.5 rounded-xl border border-slate-200">
            {activeBranches.map((branch) => {
              const checked = selectedBranchIds.includes(branch.id);
              return (
                <label
                  key={branch.id}
                  className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                    checked
                      ? "bg-emerald-50 border-petgreen text-petblue font-bold"
                      : "bg-white border-slate-200 text-slate-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleBranchSelection(branch.id)}
                    className="accent-emerald-600 w-4 h-4"
                  />
                  <div className="min-w-0">
                    <span className="block truncate">{branch.name}</span>
                    <span className="text-[11px] text-slate-500 font-normal block truncate">
                      {branch.clinicName} • {branch.city}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
          Correo Institucional <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Mail className="w-5 h-5" />
          </span>
          <input
            type="email"
            name="email"
            required
            placeholder="veterinario@colegio.com"
            value={vetForm.email}
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
            minLength={6}
            placeholder="••••••••"
            value={vetForm.password}
            onChange={handleChange}
            className="w-full pl-10 pr-12 py-2 min-h-[44px] text-base bg-petlight border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-petgreen text-petblue font-medium placeholder-slate-400"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-3 text-slate-400 hover:text-petgreen transition-colors"
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
          Confirmar Contraseña <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Lock className="w-5 h-5" />
          </span>
          <input
            type={showConfirmPassword ? "text" : "password"}
            name="confirmPassword"
            required
            minLength={6}
            placeholder="••••••••"
            value={vetForm.confirmPassword}
            onChange={handleChange}
            className="w-full pl-10 pr-12 py-2 min-h-[44px] text-base bg-petlight border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-petgreen text-petblue font-medium placeholder-slate-400"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-3 text-slate-400 hover:text-petgreen transition-colors"
          >
            {showConfirmPassword ? (
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
          className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-petgreen hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-70 cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Procesando Solicitud...</span>
            </>
          ) : (
            <>
              <span>Enviar Solicitud de Alta</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}