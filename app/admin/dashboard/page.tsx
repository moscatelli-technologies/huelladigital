"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CreditCard,
  Stethoscope,
  Building2,
  Package,
  ShoppingBag,
  Users,
  Lock,
  Mail,
  Loader2,
  LogOut,
  Eye,
  EyeOff,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// Importación de Módulos Separados
import ModuleClinics from "./components/ModuleClinics";
import ModuleCommunity from "./components/ModuleCommunity";
import ModuleOrders from "./components/ModuleOrders";
import ModuleProducts from "./components/ModuleProducts";
import ModuleNfc from "./components/ModuleNfc";
import ModuleVets from "./components/ModuleVets";

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<
    "nfc" | "vets" | "clinics" | "orders" | "products" | "community"
  >("clinics");

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");

  // Estado del formulario de login admin
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");

  const verifyAdminSession = async () => {
    setCheckingAuth(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsAdmin(false);
        setAdminEmail("");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (error || !profile || profile.role !== "admin") {
        setIsAdmin(false);
        setAdminEmail("");
        return;
      }

      setIsAdmin(true);
      setAdminEmail(user.email || "");
    } catch {
      setIsAdmin(false);
    } finally {
      setCheckingAuth(false);
    }
  };

  useEffect(() => {
    verifyAdminSession();
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setAuthError("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.user) {
        throw new Error("Credenciales inválidas. Revisá tu correo y contraseña.");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (profileError || !profile || profile.role !== "admin") {
        await supabase.auth.signOut();
        throw new Error(
          "Esta cuenta no tiene permisos de administrador (role: admin)."
        );
      }

      setIsAdmin(true);
      setAdminEmail(data.user.email || email.trim());
      setPassword("");
    } catch (err: any) {
      setAuthError(err.message || "No se pudo iniciar sesión.");
      setIsAdmin(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setAdminEmail("");
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 text-white p-7 text-center">
            <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-indigo-500/30">
              <ShieldCheck className="w-7 h-7 text-indigo-400" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              Acceso Administrativo
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Centro de Comando • HuellaDigital
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="p-6 sm:p-7 space-y-4">
            {authError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs font-medium border border-red-100 text-center">
                {authError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Correo Admin <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-5 h-5" />
                </span>
                <input
                  type="email"
                  required
                  placeholder="admin@huellas.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 min-h-[44px] text-base bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-medium"
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
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-2.5 min-h-[44px] text-base bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-indigo-600 transition-colors p-1"
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

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all disabled:opacity-70 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Verificando...</span>
                </>
              ) : (
                <span>Ingresar al Panel Admin</span>
              )}
            </button>

            <div className="text-center pt-2">
              <Link
                href="/"
                className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                ← Volver al Sitio
              </Link>
            </div>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-12 overflow-x-hidden text-slate-800">
      <nav className="bg-slate-900 text-white shadow-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <span className="font-bold tracking-wide block">
                Centro de Comando
              </span>
              <span className="text-xs text-slate-400">
                {adminEmail ? `${adminEmail} • ` : ""}Backoffice Administrativo
                Modular
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-xs font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl transition-all"
            >
              Volver al Sitio
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs font-bold bg-red-500/20 hover:bg-red-500/30 text-red-200 px-3.5 py-2 rounded-xl border border-red-500/30 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto mt-8 px-4 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Menú Lateral Modular */}
        <div className="lg:col-span-1 space-y-2">
          <button
            onClick={() => setActiveTab("clinics")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === "clinics"
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Building2 className="w-4 h-4" />{" "}
            <span>Infraestructura Clínica</span>
          </button>

          <button
            onClick={() => setActiveTab("community")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === "community"
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Users className="w-4 h-4" /> <span>Moderación Comunidad</span>
          </button>

          <button
            onClick={() => setActiveTab("orders")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === "orders"
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Package className="w-4 h-4" /> <span>Ventas y Envíos</span>
          </button>

          <button
            onClick={() => setActiveTab("products")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === "products"
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <ShoppingBag className="w-4 h-4" /> <span>Catálogo y Tienda</span>
          </button>

          <button
            onClick={() => setActiveTab("nfc")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === "nfc"
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <CreditCard className="w-4 h-4" /> <span>Inventario NFC</span>
          </button>

          <button
            onClick={() => setActiveTab("vets")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === "vets"
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Stethoscope className="w-4 h-4" /> <span>Auditoría Médica</span>
          </button>
        </div>

        {/* Panel Principal */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-200 min-h-[500px]">
          {activeTab === "clinics" && <ModuleClinics />}
          {activeTab === "community" && <ModuleCommunity />}
          {activeTab === "orders" && <ModuleOrders />}
          {activeTab === "products" && <ModuleProducts />}
          {activeTab === "nfc" && <ModuleNfc />}
          {activeTab === "vets" && <ModuleVets />}
        </div>
      </div>
    </main>
  );
}