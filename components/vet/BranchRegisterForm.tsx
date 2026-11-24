"use client";

import React, { useState } from "react";
import {
  Building2,
  Lock,
  Mail,
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
  MapPin,
  FileText,
  Link2,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface BranchRegisterFormProps {
  onSuccess: (summary: { title: string; message: React.ReactNode }) => void;
}

export default function BranchRegisterForm({
  onSuccess,
}: BranchRegisterFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [branchForm, setBranchForm] = useState({
    clinicName: "",
    cuit: "",
    branchName: "",
    city: "Posadas",
    address: "",
    mapsUrl: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBranchForm({
      ...branchForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    try {
      if (branchForm.password !== branchForm.confirmPassword) {
        throw new Error(
          "Las contraseñas no coinciden. Verifícalas e intenta nuevamente."
        );
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: branchForm.email,
        password: branchForm.password,
      });

      if (authError) throw new Error(authError.message);
      if (!authData.user) {
        throw new Error("No se pudo crear la cuenta de la sucursal.");
      }

      const userId = authData.user.id;
      const cleanClinicName = branchForm.clinicName.trim();
      const cleanBranchName = branchForm.branchName.trim();
      const cleanCuit = branchForm.cuit.trim();
      const cleanCity = branchForm.city.trim();
      const cleanAddress = branchForm.address.trim();
      const cleanMapsUrl = branchForm.mapsUrl.trim();

      const { data: createdBranchId, error: rpcError } = await supabase.rpc(
        "register_clinic_branch_request",
        {
          p_clinic_name: cleanClinicName,
          p_cuit: cleanCuit || null,
          p_branch_name: cleanBranchName || null,
          p_city: cleanCity,
          p_address: cleanAddress,
          p_maps_url: cleanMapsUrl || null,
        }
      );

      if (rpcError || !createdBranchId) {
        throw new Error(
          "Fallo al registrar la sucursal: " +
            (rpcError?.message || "No se obtuvo el ID de sucursal.")
        );
      }

      const profileDisplayName = cleanBranchName
        ? `${cleanClinicName} - ${cleanBranchName}`
        : cleanClinicName;

      const { error: profileError } = await supabase.from("profiles").upsert([
        {
          id: userId,
          full_name: profileDisplayName,
          role: "clinic_admin",
          branch_id: createdBranchId,
          location: `${cleanCity}, Misiones, Argentina`,
        },
      ]);

      if (profileError) {
        throw new Error(
          "Fallo al configurar el perfil de la sucursal: " +
            profileError.message
        );
      }

      onSuccess({
        title: "¡Solicitud Enviada!",
        message: (
          <>
            La solicitud de <strong>{cleanClinicName}</strong>
            {cleanBranchName && (
              <>
                {" "}
                (<strong>{cleanBranchName}</strong>)
              </>
            )}{" "}
            fue registrada en estado de{" "}
            <span className="font-bold text-yellow-600">
              Habilitación Pendiente
            </span>
            . Una vez aprobada, la sucursal podrá iniciar sesión y operar en
            mostrador.
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
          Nombre de la Clínica <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Building2 className="w-5 h-5" />
          </span>
          <input
            type="text"
            name="clinicName"
            required
            placeholder="Ej. Clínica Veterinaria Misiones"
            value={branchForm.clinicName}
            onChange={handleChange}
            className="w-full pl-10 pr-4 py-2 min-h-11 text-base bg-petlight border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-petgreen text-petblue font-medium placeholder-slate-400"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
          CUIT{" "}
          <span className="text-slate-400 font-normal normal-case">
            (Opcional)
          </span>
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <FileText className="w-5 h-5" />
          </span>
          <input
            type="text"
            name="cuit"
            placeholder="Ej. 30-71800000-1"
            value={branchForm.cuit}
            onChange={handleChange}
            className="w-full pl-10 pr-4 py-2 min-h-11 text-base bg-petlight border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-petgreen text-petblue font-medium placeholder-slate-400"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
          Nombre de la Sucursal{" "}
          <span className="text-slate-400 font-normal normal-case">
            (Opcional)
          </span>
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Building2 className="w-5 h-5" />
          </span>
          <input
            type="text"
            name="branchName"
            placeholder="Ej. Sucursal Centro (dejar vacío si es única)"
            value={branchForm.branchName}
            onChange={handleChange}
            className="w-full pl-10 pr-4 py-2 min-h-11 text-base bg-petlight border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-petgreen text-petblue font-medium placeholder-slate-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
            Ciudad <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="city"
            required
            placeholder="Posadas"
            value={branchForm.city}
            onChange={handleChange}
            className="w-full px-3.5 py-2 min-h-11 text-base bg-petlight border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-petgreen text-petblue font-medium placeholder-slate-400"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
            Dirección <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <MapPin className="w-4 h-4" />
            </span>
            <input
              type="text"
              name="address"
              required
              placeholder="Av. Mitre 1200"
              value={branchForm.address}
              onChange={handleChange}
              className="w-full pl-9 pr-3 py-2 min-h-11 text-base bg-petlight border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-petgreen text-petblue font-medium placeholder-slate-400"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
          Enlace de Google Maps{" "}
          <span className="text-slate-400 font-normal normal-case">
            (Opcional)
          </span>
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Link2 className="w-5 h-5" />
          </span>
          <input
            type="url"
            name="mapsUrl"
            placeholder="https://maps.app.goo.gl/..."
            value={branchForm.mapsUrl}
            onChange={handleChange}
            className="w-full pl-10 pr-4 py-2 min-h-11 text-base bg-petlight border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-petgreen text-petblue font-medium placeholder-slate-400"
          />
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Pegá el link de "Compartir" de Google Maps para fijar la
          ubicación exacta en el directorio.
        </p>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
          Correo de la Sucursal <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Mail className="w-5 h-5" />
          </span>
          <input
            type="email"
            name="email"
            required
            placeholder="mostrador.centro@clinica.com"
            value={branchForm.email}
            onChange={handleChange}
            className="w-full pl-10 pr-4 py-2 min-h-11 text-base bg-petlight border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-petgreen text-petblue font-medium placeholder-slate-400"
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
            value={branchForm.password}
            onChange={handleChange}
            className="w-full pl-10 pr-12 py-2 min-h-11 text-base bg-petlight border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-petgreen text-petblue font-medium placeholder-slate-400"
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
            value={branchForm.confirmPassword}
            onChange={handleChange}
            className="w-full pl-10 pr-12 py-2 min-h-11 text-base bg-petlight border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-petgreen text-petblue font-medium placeholder-slate-400"
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
          className="w-full min-h-11 flex items-center justify-center gap-2 bg-petgreen hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-70 cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Procesando Solicitud...</span>
            </>
          ) : (
            <>
              <span>Solicitar Alta de Sucursal</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}